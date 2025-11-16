#!/bin/bash
# Test script for feed endpoint

API_URL="http://localhost:8000/api"
TOKEN="your_token_here"  # You'll need to replace this with a real token

echo "Testing Feed Endpoint"
echo "======================"
echo ""

echo "1. Default feed (no filters):"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/feed/" | python -m json.tool | head -20

echo ""
echo "2. Friend posts only:"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/feed/?show_friend_posts=true&show_page_posts=false" | python -m json.tool | head -20

echo ""
echo "3. Page posts only:"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/feed/?show_friend_posts=false&show_page_posts=true" | python -m json.tool | head -20

echo ""
echo "4. Category filter (tech):"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/feed/?preferred_categories=tech" | python -m json.tool | head -20
