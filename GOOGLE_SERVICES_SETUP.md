# Google Services Setup for Android

## Where to Place google-services.json

Copy your downloaded `google-services.json` to:

```
C:\Users\na\Desktop\MyDuka\android\app\google-services.json
```

This path is already configured in the build.gradle file to automatically detect and use the Firebase configuration.

## File Location
```
MyDuka/
├── android/
│   └── app/
│       └── google-services.json  ← PASTE YOUR FILE HERE
```

## What It Does
- Configures Firebase integration for your Android app
- Sets up Google Play Services
- Enables push notifications
- Links to your Firebase project

## After Placing the File
1. The build.gradle will automatically detect it
2. Firebase plugin will be applied
3. Run: `npx cap sync android`
4. Open in Android Studio to verify

## If File is Missing
- The app will still build and run
- But Firebase features (auth, database, notifications) won't work
- You'll see a warning in logs: "google-services.json not found"

## Getting google-services.json
1. Go to Firebase Console
2. Select your MyDuka project
3. Settings → Your apps → Android
4. Download google-services.json
5. Place it in: `android/app/google-services.json`
