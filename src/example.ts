/**
 * BOSSA Web Firmware Flasher Example
 *
 * Easy firmware flashing for ATSAMD21G-based devices using Web Serial API.
 * The flow: Select firmware → Click Flash → Auto-reset to bootloader → Flash → Done
 */

import { SamBA } from './samba';
import { Device, Family } from './device';
import { Flasher, FlasherObserver } from './flasher';
import { sleep } from './util';

// Flash offset for SAMD devices with bootloader (bootloader uses first 8KB)
// This is where the application code starts
const BOOTLOADER_SIZE = 0x2000; // 8KB

// USB Vendor IDs for common Arduino/Adafruit devices. These VIDs are specific for bootloader mode.
const USB_FILTERS = [
    { usbVendorId: 0x239A }, // Adafruit
    { usbVendorId: 0x2341 }, // Arduino
    { usbVendorId: 0x1B4F }, // SparkFun
    { usbVendorId: 0x03EB }, // Atmel/Microchip
];

// UI Elements
let flashBtn: HTMLButtonElement;
let fileInput: HTMLInputElement;
let progressBar: HTMLProgressElement;
let progressText: HTMLSpanElement;
let statusLog: HTMLDivElement;
let fileInfo: HTMLDivElement;

// State
let firmwareData: Uint8Array | null = null;
let firmwareFileName: string = '';

/**
 * Check if the browser supports Web Serial API
 */
function checkBrowserSupport(): boolean {
    if (!('serial' in navigator)) {
        logError('Web Serial API is not supported in this browser.');
        logError('Please use a Chromium-based browser (Chrome 89+, Edge 89+, Opera 75+, Brave1.22+, etc.');
        return false;
    }
    return true;
}

/**
 * Log a message to the status log
 */
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function logError(message: string): void {
    log(message, 'error');
}

function logSuccess(message: string): void {
    log(message, 'success');
}

function logWarning(message: string): void {
    log(message, 'warning');
}

/**
 * Update the progress bar
 */
function updateProgress(current: number, total: number): void {
    const percent = Math.round((current / total) * 100);
    progressBar.value = percent;
    progressText.textContent = `${percent}%`;
}

/**
 * Reset progress bar to zero
 */
function resetProgress(): void {
    progressBar.value = 0;
    progressText.textContent = '0%';
}

/**
 * Enable or disable UI elements based on state
 */
function updateUI(): void {
    const hasFirmware = firmwareData !== null;
    
    flashBtn.disabled = !hasFirmware;
    
    if (hasFirmware) {
        fileInfo.textContent = `${firmwareFileName} (${firmwareData!.length.toLocaleString()} bytes)`;
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
}

/**
 * Handle file selection
 */
async function handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
        firmwareData = null;
        firmwareFileName = '';
        updateUI();
        return;
    }
    
    if (!file.name.endsWith('.bin')) {
        logWarning('Selected file does not have .bin extension. Make sure it\'s a valid firmware file.');
    }
    
    try {
        const buffer = await file.arrayBuffer();
        firmwareData = new Uint8Array(buffer);
        firmwareFileName = file.name;
        log(`Loaded firmware: ${file.name} (${firmwareData.length.toLocaleString()} bytes)`);
        updateUI();
    } catch (error) {
        logError(`Failed to read file: ${error}`);
        firmwareData = null;
        firmwareFileName = '';
        updateUI();
    }
}

/**
 * Perform 1200 baud touch to reset device into bootloader mode
 * This is the technique used by the Arduino IDE to enter the bootloader
 */
async function resetToBootloader(port: SerialPort): Promise<void> {
    log('Resetting device to bootloader mode...');
    
    try {
        // Open at 1200 baud
        await port.open({
            baudRate: 1200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
        });
        
        // Toggle DTR to trigger reset
        // Setting DTR false then true triggers the bootloader on SAMD devices
        await port.setSignals({ dataTerminalReady: false });
        await sleep(100);
        await port.setSignals({ dataTerminalReady: true });
        await sleep(100);
        await port.setSignals({ dataTerminalReady: false });
        
        // Close the port
        await port.close();
        
        log('Reset signal sent, waiting for bootloader...');
        
        // Wait for the device to reset and enumerate as bootloader
        // The bootloader takes about 1-2 seconds to appear
        await sleep(2000);
        
        logSuccess('Device should now be in bootloader mode');
        
    } catch (error) {
        // If we can't open the port, device might already be in bootloader mode
        log('Could not perform reset - device may already be in bootloader mode');
    }
}

/**
 * Try to find the bootloader port from previously authorized ports
 */
async function findBootloaderPort(): Promise<SerialPort | null> {
    try {
        const ports = await navigator.serial.getPorts();
        
        // Look for a port that might be the bootloader
        // After reset, a new port typically appears with the same vendor ID
        for (const port of ports) {
            const info = port.getInfo();
            // Check if it matches our known vendor IDs
            if (info.usbVendorId && USB_FILTERS.some(f => f.usbVendorId === info.usbVendorId)) {
                log(`Found potential bootloader port: VID=${info.usbVendorId?.toString(16)}, PID=${info.usbProductId?.toString(16)}`);
                return port;
            }
        }
    } catch (e) {
        // getPorts not available or failed
    }
    return null;
}

/**
 * Main flash process - handles everything from port selection to flashing
 */
async function flashFirmware(): Promise<void> {
    if (!firmwareData) {
        logError('No firmware file selected.');
        return;
    }
    
    if (!checkBrowserSupport()) {
        return;
    }
    
    // Disable UI during flash
    flashBtn.disabled = true;
    fileInput.disabled = true;
    resetProgress();
    
    let normalPort: SerialPort | null = null;
    let bootloaderPort: SerialPort | null = null;
    let samba: SamBA | null = null;
    
    try {
        // Step 1: Request the normal (sketch) port
        log('Step 1: Select your device\'s serial port');
        log('If already in bootloader mode, select the bootloader port', 'warning');
        
        normalPort = await navigator.serial.requestPort({
            filters: USB_FILTERS
        });
        
        log('Serial port selected');
        
        // Step 2: Try to reset to bootloader
        // First check if it's already in bootloader mode by trying to connect
        let isBootloaderMode = false;
        
        try {
            log('Checking if device is already in bootloader mode...');
            
            // Try to open at bootloader baud rate and read version
            await normalPort.open({
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                bufferSize: 63,
                flowControl: 'hardware',
                baudRate: 921600
            });
            
            // Create a temporary SamBA to test
            const testSamba = new SamBA(normalPort, { debug: false });
            
            // Try to set binary mode - if this works, we're in bootloader
            // This will timeout quickly if not in bootloader mode
            // We need to manually test since connect() will throw on failure
            
            await normalPort.close();
            
            // If we got here without error, it might be bootloader mode
            // But we need to actually test the protocol
            isBootloaderMode = false; // Assume not in bootloader, do reset
            
        } catch (e) {
            // Port couldn't be opened or test failed - definitely not in bootloader mode
            isBootloaderMode = false;
        }
        
        if (!isBootloaderMode) {
            // Perform 1200 baud touch reset
            await resetToBootloader(normalPort);
            
            // After reset, we need to get a new port reference
            // The original port is no longer valid
            normalPort = null;
            
            // Step 3: Try to find the bootloader port automatically
            log('Step 2: Looking for bootloader port...');
            
            bootloaderPort = await findBootloaderPort();
            
            if (!bootloaderPort) {
                // Need user to select the bootloader port manually
                log('Please select the bootloader port (it may have a different name now)', 'warning');
                
                bootloaderPort = await navigator.serial.requestPort({
                    filters: USB_FILTERS
                });
            }
        } else {
            bootloaderPort = normalPort;
        }
        
        // Step 3/4: Connect to bootloader
        log('Step 3: Connecting to bootloader...');
        
        samba = new SamBA(bootloaderPort, {
            debug: true,
            logger: {
                debug: (msg: unknown, ...args: unknown[]) => console.log(`DEBUG: ${msg}`, ...args),
                log: (msg: unknown, ...args: unknown[]) => log(`${msg} ${args.join(' ')}`),
                error: (msg: unknown, ...args: unknown[]) => logError(`${msg} ${args.join(' ')}`),
            }
        });
        
        await samba.connect();
        logSuccess('Connected to SAM-BA bootloader');
        
        // Detect device
        log('Detecting device...');
        const device = new Device(samba);
        await device.create();
        
        const flash = device.flash;
        if (!flash) {
            throw new Error('Flash not available on this device');
        }
        
        const sizeKB = Math.round(flash.totalSize / 1024);
        const info = `Device: ${flash.numPages} pages × ${flash.pageSize} bytes = ${sizeKB}KB flash`;
        logSuccess(info);
        
        // Determine flash offset based on device family
        // SAMD21 and similar devices with bootloader need 0x2000 offset
        let flashOffset = 0;
        if (device.family === Family.FAMILY_SAMD21 ||
            device.family === Family.FAMILY_SAMR21 ||
            device.family === Family.FAMILY_SAML21) {
            flashOffset = BOOTLOADER_SIZE;
            log(`Using flash offset 0x${flashOffset.toString(16).toUpperCase()} (bootloader present)`);
        }
        
        // Check firmware size (accounting for bootloader area)
        const availableFlash = flash.totalSize - flashOffset;
        if (firmwareData.length > availableFlash) {
            throw new Error(`Firmware (${firmwareData.length} bytes) is larger than available flash (${availableFlash} bytes after bootloader)`);
        }
        
        // Step 4: Flash the firmware
        log('Step 4: Flashing firmware...');
        
        const observer: FlasherObserver = {
            onStatus: (message: string) => {
                log(message.trim());
            },
            onProgress: (current: number, total: number) => {
                updateProgress(current, total);
            }
        };
        
        const flasher = new Flasher(samba, flash, observer);
        
        // Erase flash (only the application area, not the bootloader)
        log(`Erasing flash at offset 0x${flashOffset.toString(16).toUpperCase()}...`);
        await flasher.erase(flashOffset);
        logSuccess('Flash erased');
        
        // Write firmware to the correct offset
        log(`Writing firmware at offset 0x${flashOffset.toString(16).toUpperCase()}...`);
        await flasher.write(firmwareData, flashOffset);
        logSuccess('Firmware written successfully!');
        
        // Reset device to run new firmware
        log('Resetting device...');
        await device.reset();
        
        // Disconnect
        try {
            await samba.disconnect();
        } catch (e) {
            // Reset may have already disconnected
        }
        
        try {
            await bootloaderPort.close();
        } catch (e) {
            // May already be closed
        }
        
        logSuccess('✅ Flash complete! Your device is now running the new firmware.');
        updateProgress(100, 100);
        
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                log('No port selected - cancelled by user');
            } else if (error.message.includes('DeviceUnsupported')) {
                logError('Device not supported. Supported devices: ATSAMD21-based boards');
            } else {
                logError(`Flash failed: ${error.message}`);
            }
        } else {
            logError(`Flash failed: ${error}`);
        }
        
        // Cleanup on error
        try {
            if (samba) {
                await samba.disconnect();
            }
        } catch (e) { /* ignore */ }
        
        try {
            if (bootloaderPort) {
                await bootloaderPort.close();
            }
        } catch (e) { /* ignore */ }
        
        try {
            if (normalPort && normalPort !== bootloaderPort) {
                await normalPort.close();
            }
        } catch (e) { /* ignore */ }
        
    } finally {
        flashBtn.disabled = false;
        fileInput.disabled = false;
    }
}

/**
 * Initialize the application
 */
function init(): void {
    // Get UI elements
    flashBtn = document.getElementById('flashBtn') as HTMLButtonElement;
    fileInput = document.getElementById('fileInput') as HTMLInputElement;
    progressBar = document.getElementById('progressBar') as HTMLProgressElement;
    progressText = document.getElementById('progressText') as HTMLSpanElement;
    statusLog = document.getElementById('statusLog') as HTMLDivElement;
    fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
    
    // Set up event listeners
    flashBtn.addEventListener('click', flashFirmware);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Initial UI state
    updateUI();
    
    // Check browser support
    if (checkBrowserSupport()) {
        log('Ready. Select a firmware file and click "Flash Firmware" to begin.');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for module usage
export { init, flashFirmware };