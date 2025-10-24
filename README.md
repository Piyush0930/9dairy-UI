# Dairy-9 Mobile App 👋

A modern React Native mobile application for dairy product management and ordering, built with Expo. This app provides a seamless experience for customers to browse, order, and track dairy products while offering admin capabilities for managing inventory, categories, and orders.

## Features

### Customer Features
- Browse dairy products by categories (Milk, Cheese, Ghee, Yogurt, etc.)
- Add products to cart and manage quantities
- Secure checkout process
- Order tracking and history
- User authentication and profile management
- Wallet integration for quick payments

### Admin Features
- Product management (CRUD operations)
- Category management
- Order management and status updates
- Inventory tracking
- Sales analytics and reporting

## Environment Configuration

The app uses environment variables for API configuration to support different deployment environments:

### Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
EXPO_PUBLIC_API_URL=http://your-api-endpoint:port
```

**Example for development:**
```env
EXPO_PUBLIC_API_URL=http://10.55.13.5:5000
```

**Example for production:**
```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

### API Endpoints

The app communicates with a backend API that provides the following endpoints:

- `/api/catalog/products` - Product management
- `/api/catalog/categories` - Category management
- `/api/orders` - Order management
- `/api/auth` - Authentication

## Tech Stack

- **Framework:** React Native with Expo
- **Navigation:** Expo Router (file-based routing)
- **State Management:** React Context API
- **Styling:** React Native StyleSheet
- **Icons:** Expo Vector Icons
- **HTTP Client:** Fetch API
- **Storage:** AsyncStorage for local data persistence

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
