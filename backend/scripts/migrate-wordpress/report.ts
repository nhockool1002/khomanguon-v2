export interface StepSummary {
  step: string;
  read: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { ref: string; message: string }[];
}

// Thu thập số liệu từng bước để in JSON cuối script — đây là "báo cáo dry-run" bạn xem trước khi
// cho ghi DB thật (Migration_Plan.md §5 bước 4-5).
export class Report {
  private readonly summaries: StepSummary[] = [];

  startStep(step: string): StepSummary {
    const summary: StepSummary = { step, read: 0, created: 0, updated: 0, skipped: 0, errors: [] };
    this.summaries.push(summary);
    return summary;
  }

  print(dryRun: boolean): void {
    const output = {
      mode: dryRun ? 'dry-run (không ghi gì)' : 'thật (đã ghi DB/storage)',
      steps: this.summaries,
      totalErrors: this.summaries.reduce((sum, s) => sum + s.errors.length, 0),
    };
    console.log(JSON.stringify(output, null, 2));
  }
}
