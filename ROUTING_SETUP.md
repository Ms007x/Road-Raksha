# GraphHopper Setup Instructions

## 🚀 Quick Start (Easier than Mapbox!)

### Step 1: Get Your GraphHopper API Key

1. **Sign up** at: https://graphhopper.com/dashboard/#/register
2. **Verify your email** (check your inbox)
3. **Login** to your dashboard: https://graphhopper.com/dashboard/
4. **Copy** your API key from the dashboard

### Step 2: Configure Your Project

Open the `.env` file in the project root and replace the placeholder:

```env
GRAPHHOPPER_API_KEY=your_api_key_here
```

### Step 3: Start the Server

```bash
rr-start
```

That's it! Ambulances will now follow actual roads. 🚑

---

## ✅ What's Been Implemented

- ✅ GraphHopper Directions API integration
- ✅ Automatic fallback to straight-line if key is missing
- ✅ Error handling with 5-second timeout
- ✅ Environment variable configuration
- ✅ Road-based routing for all ambulances

## 📊 Free Tier Limits

- **500 requests/day** - completely free
- No credit card required
- Perfect for development and testing

## 🔧 Troubleshooting

**If you see "GraphHopper API key not configured" warning:**
- Make sure you added your key to `.env`
- Restart the server with `rr-stop` then `rr-start`

**If ambulances still move in straight lines:**
- Check that your API key is valid
- Look for "GraphHopper Routing Error" in server logs
- The system will automatically fallback to straight-line on API errors

## 💡 Why GraphHopper?

- ✅ Simpler signup process
- ✅ No payment info required
- ✅ Open-source routing engine
- ✅ Good coverage worldwide
