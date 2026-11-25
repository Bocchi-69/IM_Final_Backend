import { ShiftRepository } from "@/repositories/shift-repository";

async function testShiftLogs() {
  console.log("🧪 Testing Shift Logs and Drawer Cash Calculations...\n");

  const shiftRepo = new ShiftRepository();
  const storeId = 1;

  const shifts = await shiftRepo.listShifts(storeId, 5);
  console.log(`Retrieved ${shifts.length} shifts from store ${storeId}.\n`);

  if (shifts.length === 0) {
    console.log("ℹ️ No shifts found in store 1 to inspect. (Test still valid)");
    process.exit(0);
  }

  let allValid = true;
  for (const s of shifts) {
    console.log(`Shift #${s.id} - Cashier: ${s.user?.name}`);
    console.log(`  • Starting Float: ₱${s.opening_float}`);
    console.log(`  • Sales Total: ₱${s.total} (${s.sales_count} sales)`);
    console.log(`  • Cash Drops: ₱${s.cash_drops_total}`);
    console.log(`  • Drawer Cash: ₱${s.drawer_cash}`);
    console.log(`  • Overall Cash Handled: ₱${s.overall_cash}`);

    // Verify formulas
    const expectedDrawer = Math.max(0, Math.round(((s.opening_float || 500) + (s.total || 0) - (s.cash_drops_total || 0)) * 100) / 100);
    const expectedOverall = Math.round(((s.opening_float || 500) + (s.total || 0)) * 100) / 100;

    const drawerValid = Math.abs((s.drawer_cash ?? 0) - expectedDrawer) < 0.01;
    const overallValid = Math.abs((s.overall_cash ?? 0) - expectedOverall) < 0.01;

    if (!drawerValid || !overallValid) {
      console.error(`  ❌ Mismatch for Shift #${s.id}! Expected Drawer: ${expectedDrawer}, got ${s.drawer_cash}. Expected Overall: ${expectedOverall}, got ${s.overall_cash}`);
      allValid = false;
    } else {
      console.log(`  ✅ Calculations verified mathematically.`);
    }
  }

  if (allValid) {
    console.log("\n🎉 ALL SHIFT LOGS AND DRAWER CASH TESTS PASSED!");
    process.exit(0);
  } else {
    console.error("\n❌ SOME CHECKS FAILED!");
    process.exit(1);
  }
}

testShiftLogs().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
