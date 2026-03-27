// queue.js
const processingQueue = new Map();

function getUserQueue(userId) {
    if (!processingQueue.has(userId)) {
        processingQueue.set(userId, { 
            status: 'idle', 
            current: null, 
            queue: [] 
        });
    }
    return processingQueue.get(userId);
}

function addToQueue(userId, task) {
    const userQueue = getUserQueue(userId);
    userQueue.queue.push(task);
    console.log(`📝 User ${userId}: Added to queue (position: ${userQueue.queue.length})`);
    return userQueue.queue.length;
}

function processNextInQueue(userId) {
    const userQueue = getUserQueue(userId);
    if (userQueue.status === 'idle' && userQueue.queue.length > 0) {
        userQueue.status = 'processing';
        userQueue.current = userQueue.queue.shift();
        return userQueue.current;
    }
    return null;
}

function completeTask(userId) {
    const userQueue = getUserQueue(userId);
    userQueue.status = 'idle';
    userQueue.current = null;
    setTimeout(() => processNextInQueue(userId), 1000);
}

function getQueueStats() {
    let totalQueued = 0;
    let totalProcessing = 0;
    processingQueue.forEach((q) => {
        totalQueued += q.queue.length;
        if (q.status === 'processing') totalProcessing++;
    });
    return {
        users: processingQueue.size,
        processing: totalProcessing,
        queued: totalQueued
    };
}

module.exports = {
    getUserQueue,
    addToQueue,
    processNextInQueue,
    completeTask,
    getQueueStats
};