# Performance Testing Quick Start

**TL;DR**: Run performance tests on **release builds only** before merging changes that affect lists, images, or scrolling.

---

## 🚀 Quick Commands

### Run Performance Test (Local)

```bash
# 1. Build release
pnpm run build:android:release

# 2. Install
adb install android/app/build/outputs/apk/release/app-release.apk

# 3. Test
maestro test .maestro/community/scroll-performance.yaml
```

### Run with Perfetto Trace (Android)

```bash
# Terminal 1: Start trace
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace <<EOF
buffers: { size_kb: 63488 }
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      atrace_apps: "com.growbro.app"
      atrace_categories: "gfx"
      atrace_categories: "view"
    }
  }
}
duration_ms: 60000
EOF

# Terminal 2: Run test
maestro test .maestro/community/scroll-performance.yaml

# Terminal 1: Pull trace
adb pull /data/misc/perfetto-traces/trace perfetto-trace.pb

# Analyze at https://ui.perfetto.dev
```

### Validate Budgets

```bash
BUILD_TYPE=release \
PLATFORM=android \
DEVICE_MODEL="Your Device" \
node scripts/ci/performance-validation.js
```

---

## 📊 Performance Budgets

| Metric         | Budget  | Pass/Fail            |
| -------------- | ------- | -------------------- |
| Avg FPS        | ≥58     | CI fails if < 58     |
| P95 Frame Time | ≤16.7ms | CI fails if > 16.7ms |
| Dropped Frames | ≤1%     | CI fails if > 1%     |
| Blank Cells    | 0       | CI fails if > 0      |
| Memory Delta   | ≤50 MB  | CI fails if > 50 MB  |
| Post-GC Memory | ≤10 MB  | CI fails if > 10 MB  |

---

## ✅ Pre-Merge Checklist

Before merging changes to lists, images, or scrolling:

- [ ] Run Maestro scroll test on **release build**
- [ ] Verify all budgets pass
- [ ] Test on slow network (3G simulation)
- [ ] Test in dark mode
- [ ] Check for blank cells
- [ ] Review Perfetto trace (Android) or Instruments (iOS)
- [ ] Complete Visual QA checklist (if UI changes)

---

## 🔗 Full Documentation

- [Performance Testing README](./README.md) - Complete guide
- [Visual QA Checklist](./image-optimization-visual-qa.md) - Manual testing
- [Task 5 Summary](../../.kiro/specs/21.%20performance-and-reliability/task-5-completion-summary.md) - Implementation details

---

## 🚨 Common Issues

### "Performance tests MUST run on release builds only"

**Fix**: `export BUILD_TYPE=release` and rebuild with `--release` flag

### "Maestro output directory not found"

**Fix**: `mkdir -p maestro-results` before running test

### "Perfetto trace is suspiciously small"

**Fix**: Increase `duration_ms` in Perfetto config or check if trace is still running

---

## 📞 Need Help?

1. Check [README.md](./README.md) for detailed instructions
2. Review [Visual QA Checklist](./image-optimization-visual-qa.md)
3. Check CI logs for error details
4. Ask in #performance Slack channel

---

**Last Updated**: 2025-01-07
