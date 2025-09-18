#pragma once
#include <Arduino.h>

static const char* API_BASE_URL = "https://0vm.vercel.app";

// Starts a background FreeRTOS task that polls the server periodically.
void poller_init();

// Legacy: no-op when background task is used.
void poller_tick();

