/**
 * BOSSA Web Firmware Flasher Example
 * 
 * This module provides a simple web interface for flashing firmware
 * to ATSAMD21G-based devices (like Adafruit Feather M0) using the Web Serial API.
 */

import { SamBA } from './samba';
import { Device } from './device';
import { Flasher, FlasherObserver } from './flasher';

// UI Elements
let connectBtn: HTMLButtonElement;
let flashBtn: HTMLButtonElement;
let fileInput: HTMLInputElement;
let progressBar: HTMLProgressElement;
let progressText: HTMLSpanElement;
let statusLog: HTMLDivElement;
let deviceInfo: HTMLDivElement;

// State
let serialPort: SerialPort | null = null;
let samba: SamBA | null = null;
let device: Device | null = null;
let firmwareData: Uint8Array | null = null;

/**
 * Check if the browser supports Web Serial API
 */
function checkBrowserSupport(): boolean {
    if (!('serial' in navigator)) {
        logError('Web Serial API is not supported in this browser.');
        logError('Please use Chrome, Edge, or Opera.');
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
 * Update device info display
 */
function updateDeviceInfo(info: string): void {
    deviceInfo.textContent = info;
    deviceInfo.style.display = info ? 'block' : 'none';
}

/**
 * Enable or disable UI elements based on state
 */
function updateUI(): void {
    const isConnected = serialPort !== null && samba !== null;
    const hasFirmware = firmwareData !== null;
    
    connectBtn.textContent = isConnected ? 'Disconnect' : 'Connect Device';
    flashBtn.disabled = !isConnected || !hasFirmware;
    fileInput.disabled = !isConnected;
    
    if (!isConnected) {
        updateDeviceInfo('');
        resetProgress();
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
        updateUI();
        return;
    }
    
    if (!file.name.endsWith('.bin')) {
        logWarning('Selected file does not have .bin extension. Make sure it\'s a valid firmware file.');
    }
    
    try {
        const buffer = await file.arrayBuffer();
        firmwareData = new Uint8Array(buffer);
        log(`Loaded firmware: ${file.name} (${firmwareData.length} bytes)`);
        updateUI();
    } catch (error) {
        logError(`Failed to read file: ${error}`);
        firmwareData = null;
        updateUI();
    }
}

/**
 * Connect to the device
 */
async function connect(): Promise<void> {
    if (!checkBrowserSupport()) {
        return;
    }
    
    try {
        log('Requesting serial port access...');
        log('Select the bootloader port (enter bootloader mode by double-tapping reset)', 'warning');
        
        // Request a serial port from the user
        serialPort = await navigator.serial.requestPort({
            // Filter for common Arduino/Adafruit USB VID/PID combinations
            filters: [
                { usbVendorId: 0x239A }, // Adafruit
                { usbVendorId: 0x2341 }, // Arduino
                { usbVendorId: 0x1B4F }, // SparkFun
                { usbVendorId: 0x03EB }, // Atmel
            ]
        });
        
        log('Serial port selected');
        
        // Create SamBA connection
        samba = new SamBA(serialPort, {
            debug: true,
            logger: {
                debug: (msg: unknown, ...args: unknown[]) => log(`DEBUG: ${msg} ${args.join(' ')}`),
                log: (msg: unknown, ...args: unknown[]) => log(`${msg} ${args.join(' ')}`),
                error: (msg: unknown, ...args: unknown[]) => logError(`${msg} ${args.join(' ')}`),
            }
        });
        
        log('Connecting to bootloader...');
        await samba.connect();
        logSuccess('Connected to SAM-BA bootloader');
        
        // Detect device
        log('Detecting device...');
        device = new Device(samba);
        await device.create();
        
        const flash = device.flash;
        if (flash) {
            const sizeKB = Math.round(flash.totalSize / 1024);
            const info = `Device: ${flash.numPages} pages × ${flash.pageSize} bytes = ${sizeKB}KB flash`;
            updateDeviceInfo(info);
            logSuccess(info);
        }
        
        updateUI();
        
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.name === 'NotFoundError') {
                log('No port selected - cancelled by user');
            } else if (error.message.includes('DeviceUnsupported')) {
                logError('Device not supported. Make sure the device is in bootloader mode.');
                logError('Try double-tapping the reset button.');
            } else {
                logError(`Connection failed: ${error.message}`);
            }
        } else {
            logError(`Connection failed: ${error}`);
        }
        await disconnect();
    }
}

/**
 * Disconnect from the device
 */
async function disconnect(): Promise<void> {
    try {
        if (samba) {
            try {
                await samba.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        if (serialPort) {
            try {
                await serialPort.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    } finally {
        serialPort = null;
        samba = null;
        device = null;
        log('Disconnected');
        updateUI();
    }
}

/**
 * Handle connect/disconnect button click
 */
async function handleConnectClick(): Promise<void> {
    if (serialPort) {
        await disconnect();
    } else {
        await connect();
    }
}

/**
 * Flash the firmware to the device
 */
async function flashFirmware(): Promise<void> {
    if (!samba || !device || !firmwareData) {
        logError('Not ready to flash. Connect device and select firmware first.');
        return;
    }
    
    const flash = device.flash;
    if (!flash) {
        logError('Flash not available');
        return;
    }
    
    // Disable buttons during flash
    flashBtn.disabled = true;
    connectBtn.disabled = true;
    fileInput.disabled = true;
    
    try {
        // Create flasher with observer for progress updates
        const observer: FlasherObserver = {
            onStatus: (message: string) => {
                log(message.trim());
            },
            onProgress: (current: number, total: number) => {
                updateProgress(current, total);
            }
        };
        
        const flasher = new Flasher(samba, flash, observer);
        
        // Erase flash
        log('Erasing flash...');
        await flasher.erase(0);
        logSuccess('Flash erased');
        
        // Write firmware
        log('Writing firmware...');
        await flasher.write(firmwareData, 0);
        logSuccess('Firmware written successfully!');
        
        // Reset device
        log('Resetting device...');
        await device.reset();
        logSuccess('Device reset - new firmware should be running!');
        
        // The device will disconnect after reset
        await disconnect();
        
    } catch (error) {
        logError(`Flash failed: ${error}`);
        
        // Try to clean up
        try {
            await disconnect();
        } catch (e) {
            // Ignore cleanup errors
        }
    } finally {
        updateUI();
    }
}

/**
 * Initialize the application
 */
function init(): void {
    // Get UI elements
    connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
    flashBtn = document.getElementById('flashBtn') as HTMLButtonElement;
    fileInput = document.getElementById('fileInput') as HTMLInputElement;
    progressBar = document.getElementById('progressBar') as HTMLProgressElement;
    progressText = document.getElementById('progressText') as HTMLSpanElement;
    statusLog = document.getElementById('statusLog') as HTMLDivElement;
    deviceInfo = document.getElementById('deviceInfo') as HTMLDivElement;
    
    // Set up event listeners
    connectBtn.addEventListener('click', handleConnectClick);
    flashBtn.addEventListener('click', flashFirmware);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Initial UI state
    updateUI();
    
    // Check browser support
    if (checkBrowserSupport()) {
        log('Ready. Click "Connect Device" to begin.');
        log('Make sure your device is in bootloader mode (double-tap reset button)', 'warning');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for module usage
export { init, connect, disconnect, flashFirmware };