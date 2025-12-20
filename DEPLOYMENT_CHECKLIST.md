# MyDuka Deployment Checklist

Complete this checklist before going live with MyDuka.

## Pre-Deployment (Backend Setup)

### Firebase Project Setup
- [ ] Create Firebase project or use existing one
- [ ] Enable Firestore Database
  - [ ] Set location to nearest region
  - [ ] Start in Test Mode (or apply security rules)
- [ ] Enable Firebase Authentication
  - [ ] Email/Password provider
  - [ ] Phone Number provider
  - [ ] Configure auth limits
- [ ] Enable Firebase Storage (for reports)
- [ ] Enable Firebase Functions (for payments)
- [ ] Create Service Account key for Cloud Functions

### Firestore Security Rules
- [ ] Copy rules from IMPLEMENTATION_GUIDE.md
- [ ] Update rules in Firebase Console
- [ ] Test rules with sample data
- [ ] Set up Firestore indexes if needed

### Firebase Configuration
- [ ] Get Firebase Web Config
- [ ] Update `src/services/firebaseService.ts` with:
  - [ ] API Key
  - [ ] Auth Domain
  - [ ] Project ID
  - [ ] Storage Bucket
  - [ ] Messaging Sender ID
  - [ ] App ID
  - [ ] Measurement ID (optional)

## Development Setup

### Local Environment
- [ ] Clone/navigate to project directory
- [ ] Run `npm install`
- [ ] Copy `.env` template (if applicable)
- [ ] Run `npm run dev`
- [ ] Test in browser at http://localhost:5173

### Testing
- [ ] Create test account
- [ ] Test signup flow
- [ ] Record test sales/expenses
- [ ] Test date filtering
- [ ] Generate test reports
- [ ] Test PDF download
- [ ] Delete test data
- [ ] Logout and login again
- [ ] Test on mobile browser (Chrome DevTools)

## Web Deployment (Firebase Hosting)

### Build
- [ ] Run `npm run build`
- [ ] Verify `dist` folder created
- [ ] Test with `npm run preview`
- [ ] Check build size (should be <2MB gzip)

### Firebase Hosting
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Login: `firebase login`
- [ ] Initialize: `firebase init hosting`
- [ ] Deploy: `firebase deploy --only hosting`
- [ ] Verify live at your Firebase domain

### Post-Deploy Web
- [ ] Test signup on live site
- [ ] Test login on live site
- [ ] Record transaction on live site
- [ ] Download PDF on live site
- [ ] Test on mobile device

## Android Deployment

### Preparation
- [ ] Download Android Studio
- [ ] Install Android SDK (API 31+)
- [ ] Configure Android emulator or have device ready
- [ ] Generate signing key:
  ```bash
  keytool -genkey -v -keystore myduka.jks -keyalg RSA -keysize 2048 -validity 10000 -alias myduka
  ```

### Build
- [ ] Run `npm run cap:add:android` (first time only)
- [ ] Run `npm run cap:build`
- [ ] Run `npm run cap:open`
- [ ] Android Studio should open

### Android Studio Setup
- [ ] Wait for Gradle to sync
- [ ] Select "Build" → "Generate Signed Bundle / APK"
- [ ] Choose "APK"
- [ ] Select signing key (`myduka.jks`)
- [ ] Build APK for release

### Testing APK
- [ ] Transfer APK to Android device
- [ ] Install: `adb install -r app-release.apk`
- [ ] Test signup
- [ ] Test sales/expenses
- [ ] Test PDF export
- [ ] Test navigation
- [ ] Check permissions requested

### Google Play Store
- [ ] Create Google Play Developer Account ($25)
- [ ] Create app listing
- [ ] Add app description/screenshots
- [ ] Upload APK/AAB
- [ ] Set pricing (free or paid)
- [ ] Provide privacy policy (link to Firebase)
- [ ] Submit for review
- [ ] Monitor review status

## Production Checklist

### Security
- [ ] Change Firestore from Test Mode to Production
- [ ] Review security rules one more time
- [ ] Enable reCAPTCHA (optional)
- [ ] Set up rate limiting on functions
- [ ] Enable 2FA on Firebase account
- [ ] Archive old test data

### Performance
- [ ] Test with 100+ records
- [ ] Check page load time (<3 seconds)
- [ ] Monitor Firebase quota usage
- [ ] Enable caching headers
- [ ] Optimize images (if any)

### Monitoring
- [ ] Set up Firebase alerts
- [ ] Enable error reporting
- [ ] Monitor Firestore read/write costs
- [ ] Monitor Cloud Functions usage
- [ ] Set up daily backup reminders

### Documentation
- [ ] Create user guide
- [ ] Document known issues
- [ ] Set up support email/chat
- [ ] Create FAQ page
- [ ] Document backup procedure

### Compliance
- [ ] Create privacy policy
- [ ] Create terms of service
- [ ] GDPR compliance review
- [ ] Data retention policy
- [ ] Payment terms disclosure

## Payment Integration (Optional)

### Paystack Setup
- [ ] Create Paystack account
- [ ] Get API keys
- [ ] Deploy Cloud Functions with credentials
- [ ] Set up Paystack webhook
- [ ] Test payment flow with test card
- [ ] Configure pricing tiers
- [ ] Test refund process

### Cloud Functions
- [ ] Deploy payment functions to Firebase
- [ ] Test chargeForReport function
- [ ] Test verifyPayment function
- [ ] Monitor function logs
- [ ] Set up error alerts

## Post-Launch

### Week 1
- [ ] Monitor error logs daily
- [ ] Respond to user feedback
- [ ] Fix critical bugs immediately
- [ ] Monitor Firestore performance
- [ ] Check authentication success rate

### Month 1
- [ ] Collect user feedback
- [ ] Plan feature improvements
- [ ] Monitor usage patterns
- [ ] Review costs
- [ ] Plan first update

### Ongoing
- [ ] Regular backups (weekly)
- [ ] Security updates
- [ ] Performance monitoring
- [ ] User support
- [ ] Feature requests tracking

## Environment Variables

Add to `.env` or Firebase hosting config:
```
VITE_FIREBASE_APIKEY=xxx
VITE_FIREBASE_AUTHDOMAIN=xxx
VITE_FIREBASE_PROJECTID=xxx
VITE_FIREBASE_STORAGEBUCKET=xxx
VITE_FIREBASE_MESSAGINGSENDERID=xxx
VITE_FIREBASE_APPID=xxx
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxx
```

## Rollback Procedure

If something goes wrong:

**Web**:
```bash
firebase hosting:channels:list
firebase hosting:channels:delete CHANNEL_ID
firebase deploy --only hosting
```

**Android**:
Roll back version on Google Play Console

**Firestore**:
Use Firestore backup/restore feature

## Success Criteria

✅ App loads in <3 seconds
✅ All CRUD operations work
✅ PDF export completes
✅ No console errors
✅ Mobile responsive
✅ Works offline (caching)
✅ Handles network errors gracefully
✅ Users report no major issues

## Support Contacts

- **Firebase Support**: https://firebase.google.com/support
- **Google Play Support**: https://support.google.com/googleplay
- **Paystack Support**: support@paystack.com

## Sign-Off

- [ ] Product Owner approved
- [ ] Security review passed
- [ ] Performance acceptable
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Ready for launch

**Deployed by**: _______________
**Date**: _______________
**Version**: 1.0.0

---

**Good luck with your launch! 🚀**
