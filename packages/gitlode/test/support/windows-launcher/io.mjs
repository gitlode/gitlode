// Bounded admission/waiting, not kernel-I/O preemption. The enclosing driver owns hard exit.
export class CaseIO {
  pending = new Set();
  failures = [];
  async run(name, end, operation) {
    const now = () => Number(process.hrtime.bigint()) / 1e6;
    if (now() >= end) throw new Error(`${name} admission cutoff; retain root`);
    const abort = new AbortController();
    const entry = { name, settlement: "pending" };
    this.pending.add(entry);
    const task = Promise.resolve().then(() => {
      if (now() >= end) throw new Error(`${name} admission cutoff; retain root`);
      return operation(abort.signal);
    });
    void task.then(
      () => {
        entry.settlement = "fulfilled";
        this.pending.delete(entry);
      },
      () => {
        entry.settlement = "rejected";
        this.pending.delete(entry);
      },
    );
    let timer;
    try {
      return await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => {
              abort.abort();
              reject(new Error(`${name} deadline; I/O settlement unknown; retain root`));
            },
            Math.max(0, end - now()),
          );
        }),
      ]);
    } catch (error) {
      this.failures.push(error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  snapshot() {
    return [...this.pending].map((entry) => ({ ...entry }));
  }
}
