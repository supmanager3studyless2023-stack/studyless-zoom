// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

// Option 1: Default export
export default function proxy(request: NextRequest) {
  return NextResponse.next();
}