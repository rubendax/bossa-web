# BOSSA Web Firmware Flasher

### A one-click web-based firmware flasher for ATSAMD21G-based devices using the Web Serial API. 

## Features

- **One-click flashing** - Just select your firmware and click Flash
- **Auto-reset to bootloader** - Uses 1200 baud touch technique (like Arduino IDE)
- **Progress tracking** - Real-time progress bar and live status log

## Quick Start

### 1. Build the Project

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Build the example
npm run build:example
```

### 2. Serve the Example

```bash
# Serve locally (opens http://localhost:3000)
npm run serve
```

Or use any static file server:
```bash
npx serve example
# or
python -m http.server 8000 --directory example
```

### 3. Flash Your Device

1. **Select Firmware** - Click "Select Firmware (.bin)" and choose your compiled .bin file
2. **Click "Flash Firmware"** - The tool will automatically:
   - Ask you to select your device's serial port
   - Reset the device into bootloader mode
   - Connect to the bootloader
   - Erase and write the firmware
   - Reset the device to run the new code

That's it! Your device should now be running the new firmware.


## Browser Requirements

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 89+ | ✅ Supported |
| Edge | 89+ | ✅ Supported |
| Opera | 75+ | ✅ Supported |
| Brave | 1.22+ | ✅ Supported |
| Vivaldi | 3.7+ | ✅ Supported |
| Firefox | - | ❌ Not supported |
| Safari | - | ❌ Not supported |
| Internet Explorer | - | ❌ Not supported |

## Troubleshooting

### "Device not supported" Error

- Make sure you have an ATSAMD21-based device
- Try manually entering bootloader mode (double-tap reset)
- Check that you're selecting the correct serial port

### Browser Shows "Not Supported" Error

- Use Chrome, Edge, or Opera
- Make sure you're using a recent version (Chrome 89+, Edge 89+, Opera 75+)

### Auto-Reset Fails

- Try manually double-tapping the reset button before flashing
- Some boards may need a longer delay - try waiting a few seconds after reset

### Device Not Showing in Port List

- Check that the device is properly connected
- Try a different USB port
- On Linux, you may need to add udev rules:
  ```bash
  # Create /etc/udev/rules.d/99-arduino.rules
  SUBSYSTEM=="usb", ATTR{idVendor}=="239a", MODE="0666"
  SUBSYSTEM=="usb", ATTR{idVendor}=="2341", MODE="0666"
  ```

### Test Rig
This was tested and confirmed to successfully flash firmware to an **Adafruit Feather M0** via Chromium v142 on Mac OS 13.7. 