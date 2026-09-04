"use client";

import { useState } from "react";
import AdaptivePlanningPanel from "@/components/AdaptivePlanningPanel";
import DashboardPage from "@/components/DashboardPage";

export default function TodayPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-4">
      <AdaptivePlanningPanel onPlanChanged={() => setRevision((value) => value + 1)} />
      <DashboardPage refreshKey={revision} />
    </div>
  );
}
