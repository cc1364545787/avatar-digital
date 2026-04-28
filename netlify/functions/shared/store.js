// netlify/functions/shared/store.js

// 使用全局变量在函数间共享数据
if (!global._videoStore) {
    global._videoStore = new Map();
  }
  
  export const videoStore = global._videoStore;
  
  export function saveVideoTask(task) {
    videoStore.set(task.videoId, task);
    return task;
  }
  
  export function getVideoTask(videoId) {
    return videoStore.get(videoId);
  }
  
  export function updateVideoTask(videoId, updates) {
    const task = videoStore.get(videoId);
    if (task) {
      Object.assign(task, updates);
      videoStore.set(videoId, task);
    }
    return task;
  }