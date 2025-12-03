# BOSSA Web Firmware Flasher Example

A simple web-based firmware flasher for ATSAMD21G-based devices using the Web Serial API.

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

# Build the library and example
npm run build
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

1. **Enter Bootloader Mode**
   - Double-tap the reset button on your device
   - The LED should pulse/fade indicating bootloader mode
   - A new serial port will appear

2. **Connect**
   - Click "Connect Device"
   - Select the bootloader serial port from the browser dialog
   - On macOS: looks like `cu.usbmodem*`
   - On Windows: `COM*`
   - On Linux: `/dev/ttyACM*`

3. **Select Firmware**
   - Click "Select Firmware (.bin)"
   - Choose your compiled .bin file

4. **Flash**
   - Click "Flash Firmware"
   - Wait for the process to complete
   - The device will automatically reset and run the new firmware

## Test Firmware

A test firmware file is included in the repository root:
- **File:** `blink_1000-feather_m0.bin`
- **Description:** Blinks the LED at 1000ms intervals
- **Target:** Adafruit Feather M0

## Troubleshooting

### "Device not supported" Error

- Make sure the device is in **bootloader mode** (double-tap reset)
- The device should show a different serial port than normal operation
- Try unplugging and reconnecting the device

### "No port selected" Message

- You cancelled the port selection dialog
- Click "Connect Device" again and select a port

### Browser Shows "Not Supported" Error

- Use Chrome, Edge, or Opera
- Make sure you're using a recent version (Chrome 89+, Edge 89+, Opera 75+)

### Flash Fails Midway

- Make sure the device stays connected during flashing
- Don't move or bump the USB cable
- Try a different USB cable or port
- Re-enter bootloader mode and try again

### Device Not Showing in Port List

- Check that the device is in bootloader mode
- Try a different USB port
- On Linux, you may need to add udev rules for your device
- On macOS, the port should appear automatically

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