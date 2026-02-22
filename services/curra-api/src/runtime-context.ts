import { createRepositories, type Repositories } from './factories/repository-factory.js';
import { OutboxService } from './modules/outbox-service.js';
import { PayrollRunService } from './modules/payroll-run-service.js';

interface RuntimeContext {
  repositories: Repositories;
  outbox: OutboxService;
  payrollRuns: PayrollRunService;
}

let context: RuntimeContext | null = null;

export function getRuntimeContext(): RuntimeContext {
  if (context) {
    return context;
  }

  const repositories = createRepositories();
  const outbox = new OutboxService(repositories.outbox);
  const payrollRuns = new PayrollRunService(repositories.payrollRuns, outbox);

  context = {
    repositories,
    outbox,
    payrollRuns
  };

  return context;
}

export function resetRuntimeContextForTests(): void {
  context = null;
}
