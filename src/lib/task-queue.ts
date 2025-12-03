type QueueTask = {
  id: string
  execute: () => Promise<void>
}

class TaskQueue {
  private queue: QueueTask[] = []
  private isProcessing = false
  private minDelayBetweenTasks = 2000

  async add(task: QueueTask) {
    this.queue.push(task)
    if (!this.isProcessing) {
      await this.process()
    }
  }

  private async process() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const task = this.queue.shift()

    if (task) {
      try {
        await task.execute()
      } catch (error) {
        console.error(`Task ${task.id} failed:`, error)
      }
      
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.minDelayBetweenTasks))
      }
    }

    await this.process()
  }
}

export const taskQueue = new TaskQueue()
