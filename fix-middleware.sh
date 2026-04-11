#!/bin/bash
mkdir -p .next/server
echo 'const { NextResponse } = require("next/server"); module.exports = { default: function(req) { return NextResponse.next(); } }' > .next/server/middleware.js
echo '{"version":1,"files":[]}' > .next/server/middleware.js.nft.json