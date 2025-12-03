# BOSSA Web Firmware Flasher

A one-click web-based firmware flasher for ATSAMD21G-based devices using the Web Serial API.

## Features

- **One-click flashing** - Just select your firmware and click Flash
- **Auto-reset to bootloader** - Uses 1200 baud touch technique (like Arduino IDE)
- **Progress tracking** - Real-time progress bar and status log
- **No drivers needed** - Works directly in your browser

## Supported Devices

- Adafruit Feather M0
- Arduino Zero
- Arduino MKR series
- Other ATSAMD21-based boards

## Browser Requirements

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 89+ | ✅ Supported |
| Edge | 89+ | ✅ Supported |
| Opera | 75+ | ✅ Supported |
| Firefox | - | ❌ Not supported |
| Safari | - | ❌ Not supported |

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

## How Auto-Reset Works

The flasher uses the "1200 baud touch" technique:

1. Opens your device's serial port at 1200 baud
2. Toggles the DTR signal to trigger a reset
3. Waits for the bootloader to enumerate
4. Connects to the bootloader port for flashing

This is the same technique used by the Arduino IDE.

### If Auto-Reset Doesn't Work

Some devices or USB adapters may not support the auto-reset. In this case:

1. **Manually enter bootloader mode** by double-tapping the reset button
2. The LED should pulse/fade indicating bootloader mode
3. Then click "Flash Firmware" and select the bootloader port

## Test Firmware

A test firmware file is included in the repository root:
- **File:** `blink_1000-feather_m0.bin`
- **Description:** Blinks the LED at 1000ms intervals
- **Target:** Adafruit Feather M0

## Troubleshooting

### "Device not supported" Error

- Make sure you have an ATSAMD21-based device
- Try manually entering bootloader mode (double-tap reset)
- Check that you're selecting the correct serial port

### Browser Shows "Not Supported" Error

- Use Chrome, Edge, or Opera
- Make sure you're using a recent version (Chrome 89+, Edge 89+, Opera 75+)

### Flash Fails Midway

- Make sure the device stays connected during flashing
- Don't move or bump the USB cable
- Try a different USB cable or port
- Re-enter bootloader mode and try again

### Auto-Reset Not Working

- Not all USB-to-serial adapters support DTR toggling
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

## Development

### Project Structure

```
example/
├── index.html      # Main HTML page
├── styles.css      # Styling
├── bundle.js       # Built JavaScript (generated)
└── README.md       # This file

src/
├── example.ts      # TypeScript source for the flasher UI
├── samba.ts        # SAM-BA protocol implementation
├── device.ts       # Device detection
├── flasher.ts      # Flashing logic
└── ...
```

### Rebuilding

After modifying `src/example.ts`:

```bash
npm run build:example
```

### Debugging

Open browser DevTools (F12) to see detailed logs in the console.

## License

BSD-3-Clause - See LICENSE file in the repository root.