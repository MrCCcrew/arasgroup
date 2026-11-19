# Employee advances

The company accounting menu contains **سلف الموظفين / Employee advances**.

- Select an employee and a company cash or bank account, enter the disbursement date and amount, then choose repayment months and amounts. Months may be nonconsecutive and may span years. Equal distribution assigns rounding differences to the final installment.
- The schedule must total the advance exactly to three decimal places. Duplicate months and months before the advance date are rejected.
- Saving creates the advance, installments and a **draft** journal atomically: debit employee advances (1050), credit the selected cash/bank account. Account 1050 is created under current assets if absent; incompatible/inactive accounts are rejected. Review and post the journal through the existing accounting workflow.
- Payroll creation and editing fetch due installments by company, employee, month **and year**. The preview shows an independent advance-installment deduction. The server calculates this again and saves a separate salary item, which is included in salary details, printed payslips and existing itemized messages.
- Payroll journals credit account 1050 for the recovered installments and credit the bank for the net payment. Each recovery line identifies the employee. Payroll and its journal are saved in the same transaction.
- Installments attached to draft/approved payroll are reserved. They count as repaid only when payroll is marked PAID. Cancellation or deletion of an editable payroll releases its installments. Paid payroll cannot be reopened, edited or deleted.
- A new advance cannot use a month where that employee already has a noncancelled payroll. Select another month or recreate an unpaid editable payroll after recording the advance. Existing paid payroll is never modified retroactively.
- Advances linked to payroll cannot be cancelled. Cancelling an unlinked advance also discards its mutable journal; posted journals remain protected by existing accounting rules.
- There is no manual repayment or interest calculation in this feature. A missed month is not silently shifted into a later payroll.

## Validation

`node --env-file=.env.test node_modules/tsx/dist/cli.mjs tests/employee-advances.test.ts`

The integration test requires `rashidgroup_test`, creates isolated fixtures and cleans them up. Covers journal balancing, company boundaries, schedule precision, monthly previews, repeated edits, changing months, cancellation, concurrent payroll creation, paid-state protection and rollback for locked fiscal years.

`node node_modules/tsx/dist/cli.mjs tests/salary-adjustments.test.ts`

Migration: `prisma/migrations/20260927_employee_advances/migration.sql`. Adds two tables and a salary-payment deduction column with a zero default; existing payroll amounts are unchanged.
