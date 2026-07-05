#!/bin/bash
cd packages/web-app-vercel
npm run test -- --testPathPatterns=settingsValidator.test.ts
