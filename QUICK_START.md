# MyDuka - Quick Start Guide

Get up and running with MyDuka in 5 minutes!

## Prerequisites
- Node.js 18+
- Firebase account (https://firebase.google.com)
- Android SDK (for mobile, optional)

## Step 1: Install Dependencies
```bash
cd C:\Users\na\Desktop\MyDuka
npm install
```

## Step 2: Configure Firebase
1. Go to Firebase Console: https://console.firebase.google.com
2. Create new project or use "plot-9fd6e"
3. Copy your Web API Key
4. Update `src/services/firebaseService.ts`
5. Enable: Email/Password Auth, Phone Auth, Firestore

## Step 3: Start Development Server
```bash
npm run dev
```
Open http://localhost:5173

## Step 4: Test the App
- Sign up with email
- Create a shop
- Record sales and expenses
- View reports

## Step 5: Build for Android
```bash
npm run cap:add:android  # First time only
npm run cap:build
npm run cap:open
```

## Common Commands
- `npm run dev` - Start development
- `npm run build` - Build for production
- `npm run cap:build` - Build for Android
- `npm run cap:open` - Open Android Studio

## Full Documentation
See IMPLEMENTATION_GUIDE.md for complete details.
