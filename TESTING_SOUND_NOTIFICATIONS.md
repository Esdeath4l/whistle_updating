# 🔊 Testing Sound Notifications

## How to Test the Enhanced Notification System

### 1. **Setup for Testing**
1. Open the admin dashboard: `http://localhost:8084/admin`
2. Login with credentials: `ritika` / `satoru 2624`
3. Open the test page in another tab: `http://localhost:8084/test-socket-notifications.html`

### 2. **What Should Happen**
When you click the test buttons:

#### Regular Report Test:
- 🔔 **Default notification sound** should play (800Hz → 400Hz)
- 📱 **Browser notification** should appear
- 🍞 **Toast notification** should show in admin dashboard
- 📊 **Reports list** should refresh automatically

#### Urgent Report Test:
- 🚨 **Urgent notification sound** should play (1000Hz → 600Hz, 3x sequence)
- 📱 **Browser notification** should appear with urgent styling
- 🍞 **Urgent toast notification** should show in admin dashboard
- 📊 **Reports list** should refresh automatically
- 📄 **Document title** should flash "🚨 URGENT REPORT"

### 3. **Troubleshooting**
If you don't hear sounds:
1. **Check browser permissions**: Allow audio autoplay
2. **Check volume**: Make sure system volume is up
3. **Check console**: Look for audio context errors
4. **Try user interaction**: Click something on the page first (browsers block audio without user interaction)

### 4. **Expected Console Logs**

#### In Admin Dashboard:
```
📨 New report notification: { data: { shortId: "TEST123", priority: "medium" } }
🔊 Playing default notification sound
🔄 Refreshing report list due to new report
```

#### In Test Page:
```
✅ Connected to Socket.io server
📤 Sent test notification: TEST123
```

#### In Server Console:
```
🧪 Simulating new report notification: TEST123
📤 Test notification sent for report TEST123
```

### 5. **Sound Test Page**
For direct sound testing: `http://localhost:8084/test-notification-sound.html`

## ✅ Success Criteria
- ✅ Socket.io connection established
- ✅ Admin dashboard receives notifications
- ✅ Different sounds play for different priorities
- ✅ Browser notifications appear
- ✅ Toast notifications show in dashboard
- ✅ Reports list refreshes automatically

If all these work, the notification system with sound integration is functioning correctly!