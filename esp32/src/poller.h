#pragma once
#include <Arduino.h>

// Configure at build time via -DAPI_BASE_URL and -DCANVAS_ID

void poller_init();
void poller_tick(); // call every loop; handles 500ms cadence internally

