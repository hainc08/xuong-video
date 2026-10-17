// Follow a job through Server-Sent Events; returns a function that stops listening.
export const watchJob = (jobId, onUpdate) => {
  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
  source.onmessage = (e) => {
    const job = JSON.parse(e.data);
    onUpdate(job);
    if (job.status !== 'running') source.close();
  };
  return () => source.close();
};

// Where a finished video of this skill lands, relative to the workspace (mirrors the server's kind outputs).
export const outputsOf = (skill, id) =>
  skill.kind === 'story'
    ? {video: `out/${id}/video_${id}.mp4`, thumbnail: `out/${id}/thumbnail_${id}.png`, caption: `out/${id}/facebook_caption.txt`}
    : {video: `out/${id}.mp4`, thumbnail: null, caption: `out/${id}.txt`};
