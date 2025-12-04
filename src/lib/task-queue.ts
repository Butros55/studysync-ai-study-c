type QueueTask = {
  id: string
  execute: () => Promise<void>
}

class TaskQueue {
  private queue: QueueTask[] = []
  private isProcessing = false
  private minDelayBetweenTasks = 15000
  private consecutiveErrors = 0
  private maxConsecutiveErrors = 2

  async add(task: QueueTask) {
    this.queue.push(task)
    if (!this.isProcessing) {
      await this.process()
    }
  }

  private async process() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      this.consecutiveErrors = 0
      return
    }

    this.isProcessing = true
    const task = this.queue.shift()

    if (task) {
      try {
        await task.execute()
        this.consecutiveErrors = 0
      } catch (error) {
        console.error(`Task ${task.id} failed:`, error)
        this.consecutiveErrors++
        
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          const backoffDelay = Math.min(60000, this.minDelayBetweenTasks * Math.pow(2, this.consecutiveErrors - this.maxConsecutiveErrors))
          console.warn(`Multiple consecutive errors detected. Waiting ${backoffDelay}ms before continuing...`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
        }
      }
      
      if (this.queue.length > 0) {
        const delay = this.consecutiveErrors > 0 
          ? this.minDelayBetweenTasks * (this.consecutiveErrors + 1)
          : this.minDelayBetweenTasks
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    await this.process()
  }
  
  getQueueLength(): number {
    return this.queue.length
  }
}

export const taskQueue = new TaskQueue()
