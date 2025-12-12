# Backend Deployment Checklist - Call Features

## ✅ Pre-Deployment Verification

### 1. Models
- [x] **Call model** created in `backend/main/models.py`
  - Fields: caller, receiver, call_type, status, conversation (optional)
  - Timestamps: started_at, answered_at, ended_at
  - Duration tracking: duration_seconds
  - `end_call()` method implemented
  - Proper indexes for performance

### 2. Serializers
- [x] **CallSerializer** in `backend/main/serializers.py`
  - Includes caller and receiver (read-only)
  - caller_id and receiver_id (write-only)
  - All required fields present
  - Proper validation

### 3. Views/API Endpoints
- [x] **CallViewSet** in `backend/main/views.py`
  - `initiate()` - POST /api/calls/initiate/
  - `accept()` - POST /api/calls/{id}/accept/
  - `reject()` - POST /api/calls/{id}/reject/
  - `end()` - POST /api/calls/{id}/end/
  - Proper permissions (IsAuthenticated)
  - Queryset filters by user (caller or receiver)
  - WebSocket notifications sent

### 4. URLs
- [x] **CallViewSet registered** in `backend/main/urls.py`
  - Route: `/api/calls/`
  - Imported correctly
  - Router registration complete

### 5. WebSocket Signaling
- [x] **ChatConsumer extended** in `backend/main/consumers.py`
  - Handles `call.offer` messages
  - Handles `call.answer` messages
  - Handles `call.ice-candidate` messages
  - Handles `call.end` messages
  - Broadcasts to conversation group
  - Handlers: `call_offer()`, `call_answer()`, `call_ice_candidate()`, `call_end()`
  - Server notifications: `call_incoming()`, `call_accepted()`, `call_ended()`

### 6. Imports
- [x] **All imports verified**
  - Call model imported in views.py
  - CallSerializer imported in views.py
  - CallViewSet imported in urls.py
  - No circular imports

### 7. Syntax Check
- [x] **Python syntax valid**
  - models.py compiles
  - views.py compiles
  - serializers.py compiles
  - consumers.py compiles
  - urls.py compiles

## 📋 Deployment Steps

### Step 1: Create Migration
```bash
cd backend
source venv/bin/activate  # or your virtual environment
python manage.py makemigrations main --name add_call_model
```

### Step 2: Review Migration
```bash
python manage.py showmigrations main
# Verify the new migration appears
```

### Step 3: Run Migration
```bash
python manage.py migrate
```

### Step 4: Verify Database
```bash
python manage.py shell
>>> from main.models import Call
>>> Call.objects.count()  # Should work without errors
```

### Step 5: Test API Endpoints (Optional)
```bash
# Test initiate endpoint
curl -X POST http://localhost:8000/api/calls/initiate/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id": 2, "call_type": "voice", "conversation_id": 1}'
```

### Step 6: Deploy
- Push to repository
- Deploy to production server
- Run migrations on production
- Restart Django/ASGI server
- Restart WebSocket server (if separate)

## ⚠️ Important Notes

1. **Database Migration Required**
   - The Call model needs a migration
   - Run `makemigrations` and `migrate` before deployment

2. **WebSocket Server**
   - Ensure WebSocket server is running
   - Channels/ASGI server must be restarted after deployment

3. **No Breaking Changes**
   - All existing functionality remains intact
   - Call features are additive only

4. **Testing Recommendations**
   - Test call initiation
   - Test call acceptance
   - Test call rejection
   - Test call ending
   - Test WebSocket signaling

## 🔍 Post-Deployment Verification

1. Check Django admin (if Call model registered)
2. Test API endpoints return 200/201
3. Verify WebSocket connections work
4. Test call flow end-to-end
5. Check logs for errors

## 📝 Files Modified

- `backend/main/models.py` - Added Call model
- `backend/main/serializers.py` - Added CallSerializer
- `backend/main/views.py` - Added CallViewSet
- `backend/main/urls.py` - Registered CallViewSet
- `backend/main/consumers.py` - Added call signaling handlers

## ✅ Status: READY FOR DEPLOYMENT

All code is syntactically correct and properly integrated.

