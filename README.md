<p align="center">
  <img src="assets/logo.png" alt="Badminton Court Simulator" width="200" />
</p>

# Badminton Court Simulator

A React Native app for simulating badminton court positions and movements with enhanced UI using React Native Paper and comprehensive player customization features.

## Features

### Core Functionality
- **Interactive Court**: Drag and drop players and shuttle on a badminton court
- **Game Modes**: Switch between singles and doubles play (defaults to doubles)
- **Position History**: Undo/redo functionality for position changes
- **Trail Markers**: Visual trails showing player and shuttle movement
- **Real-time Updates**: Smooth animations and position tracking
- **Team Positioning**: Team 1 (Red) on top half, Team 2 (Blue) on bottom half

### Enhanced UI with React Native Paper
- **Modern Design**: Clean, material design interface with white header
- **Responsive Layout**: Adapts to different screen sizes
- **Smooth Animations**: Enhanced visual feedback and transitions
- **Professional Components**: Using React Native Paper for consistent UI
- **Circular Buttons**: All control buttons are perfectly circular with proper spacing

### Advanced Player Customization
- **Icon Customization**: Three types of customization for each player:
  - **Default Icon**: Material Community Icons (account, badminton, etc.)
  - **Custom Text**: Enter up to 3 characters of custom text
  - **Photo Upload**: Take a photo or select from gallery with cropping
- **Color Customization**: Continuous hue slider with full color spectrum
- **Size Adjustment**: Adjustable marker size (20-80px range) with black slider
- **Real-time Preview**: See changes immediately as you customize
- **Team-based Colors**: Team 1 (Red), Team 2 (Blue), Shuttle (White)

### Settings Panel
- **Scroll-based Expansion**: Starts at 50% height, expands to 95% when scrolling
- **Comprehensive Overview**: View all player customizations in one place
- **Visual Indicators**: See current icon, color, and size for each player
- **Organized Layout**: Grouped by teams (Team 1, Team 2) for easy management
- **Smooth Animations**: Debounced height changes for smooth scrolling
- **Quick Actions**: Reset all customizations with one click

### Icon Customization Modal
- **Three Circular Options**: Default Icon, Text, Photo (always visible)
- **Auto-save**: Changes apply immediately when selecting options
- **Photo Features**: 
  - Take photo with camera or select from gallery
  - Automatic cropping to square format
  - Image compression for optimal performance
- **Text Input**: Direct input within preview circle (max 3 characters)
- **Color-aware Preview**: Preview adapts to current marker color

## How to Use

### Basic Navigation
1. **Move Players**: Tap and drag players to reposition them on the court
2. **Move Shuttle**: Drag the shuttle to track its position
3. **Toggle Game Mode**: Use the account/account-group button to switch between singles and doubles
4. **Reset Positions**: Use the refresh button to reset all positions
5. **History Navigation**: Use undo/redo buttons to navigate position history

### Player Customization
1. **Open Settings**: Tap the menu icon in the top-left corner
2. **Select Player**: Click on any player marker preview in the settings panel
3. **Choose Customization Type**:
   - **Default Icon**: Click the default icon option
   - **Custom Text**: Click text option and type in the circle (max 3 characters)
   - **Photo**: Click photo option and tap the circle to take/select photo
4. **Adjust Color**: Use the hue slider to change marker color
5. **Adjust Size**: Use the size slider to change marker size (20-80px)

### Trail Features
- **Player Trails**: Toggle player movement trails with the foot-print icon
- **Shuttle Trails**: Toggle shuttle movement trails with the badminton icon
- **Visual Feedback**: Trails show movement from previous positions

### Settings Panel
1. **Open Settings**: Tap the menu icon in the top-left corner
2. **Scroll to Expand**: Pull up to expand the panel to 95% height
3. **View Customizations**: See all current player settings
4. **Quick Reset**: Use "Reset All" to restore default settings
5. **Close Panel**: Tap outside the panel or the menu icon again

## Technical Details

### Dependencies
- **React Native Paper**: Modern UI components and theming
- **Expo Vector Icons**: Material Community Icons for player markers
- **React Native Gesture Handler**: Smooth touch interactions
- **React Native Slider**: Size and color adjustment controls
- **Expo Image Picker**: Photo selection from camera and gallery
- **Expo Image Manipulator**: Photo cropping and compression
- **Expo Linear Gradient**: Color spectrum visualization
- **React Native Animated**: Smooth animations and transitions

### Architecture
- **Context API**: Centralized state management for customizations
- **Custom Hooks**: Reusable logic for court positions and history
- **Component Composition**: Modular, reusable components
- **TypeScript**: Full type safety throughout the application
- **IconType System**: Supports 'icon', 'text', and 'photo' types

### Performance
- **Optimized Animations**: Smooth 60fps animations using native driver
- **Efficient Rendering**: Minimal re-renders with proper state management
- **Memory Management**: Proper cleanup of timeouts and listeners
- **Image Optimization**: Automatic compression and cropping for photos
- **Debounced Updates**: Smooth scrolling without performance issues

### Build System
- **Expo SDK 52**: Latest stable Expo framework
- **Android Support**: Full Android build and deployment support
- **ProGuard Integration**: Proper code obfuscation and optimization
- **Keystore Management**: Debug and release signing configurations

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npx expo start`
4. Run on your preferred platform:
   - iOS: `npx expo run:ios`
   - Android: `npx expo run:android`
   - Web: `npx expo start --web`

## Building for Production

### Android APK Build
```bash
# Build debug APK
npx expo run:android --variant debug

# Build release APK
npx expo run:android --variant release
```

### Prerequisites
- Java Development Kit (JDK) 17 or later
- Android Studio with Android SDK
- Proper environment variables (JAVA_HOME, ANDROID_HOME)

### Build Configuration
- **Target SDK**: Android 14 (API 34)
- **Min SDK**: Android 7.0 (API 24)
- **Kotlin Version**: 1.9.25
- **ProGuard**: Enabled for release builds

## Customization Options

### Icon Types
- **Default Icons**: Material Community Icons (account, badminton, etc.)
- **Custom Text**: Up to 3 characters of custom text
- **Photos**: User-uploaded photos with automatic cropping

### Color System
- **Continuous Hue Slider**: Full color spectrum (0-360°)
- **Real-time Preview**: See color changes immediately
- **Color-aware UI**: Text and icons adapt to background color
- **Default Colors**: Team 1 (Red), Team 2 (Blue), Shuttle (White)

### Size Range
- **Player Markers**: 20-80 pixels diameter
- **Shuttle Marker**: 20-80 pixels diameter
- **Black Slider**: Consistent black color for size adjustment
- **Real-time Scaling**: All elements scale proportionally

## File Structure

```
badminton-court-simulator/
├── components/
│   ├── BadmintonCourt.tsx          # Main court component
│   ├── PlayerMarker.tsx            # Draggable player/shuttle markers
│   ├── SettingsPanel.tsx           # Settings panel with customization
│   ├── IconCustomizationModal.tsx  # Icon customization modal
│   ├── IconButton.tsx              # Custom circular button component
│   └── PositionTrail.tsx           # Movement trail visualization
├── context/
│   └── MarkerCustomizationContext.tsx  # Global customization state
├── hooks/
│   └── useCourtPositions.ts        # Court position management
├── utils/
│   ├── courtPositions.ts           # Initial position calculations
│   └── positionTracking.ts         # Position history tracking
├── types/
│   ├── game.ts                     # Game-related type definitions
│   └── positions.ts                # Position-related type definitions
└── android/                        # Android build configuration
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License.
