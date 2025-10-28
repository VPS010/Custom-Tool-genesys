# Genesys Contact Pusher

## Setup
1. Copy `.env.sample` to `.env` and fill the values from client
2. Install: `npm install`
3. Run: `npm start` or `npm run dev`

## API
**POST** `/push-to-genesys`

Body:
```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john@example.com",
  "phone": "+15551234567",
  "dropdown1": "Anxiety",
  "dropdown2": "High Stress", 
  "dropdown3": "Google",
  "message": "Interested in consult"
}
```

Response:
- 200: `{ success: true, genesysResponse: ... }`
- 400: Validation error
- 500: Error details

## Test
```bash
curl -X POST http://localhost:3000/push-to-genesys \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","phone":"+1555123456","dropdown1":"Anxiety","message":"Please contact me"}'
```