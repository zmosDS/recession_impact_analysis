// ==========================================================
// Slideshow Logic
// ==========================================================

window.addEventListener("DOMContentLoaded", () => {
  const frames = Array.from(document.querySelectorAll(".frame"));
  const dots = Array.from(document.querySelectorAll(".dot"));
  const nextBtn = document.getElementById("next");
  const restartButton = document.getElementById("restart-button");

  let currentFrame = 0; // start at first frame

  // --------------------------------------------------------
  // Core function: Show a given frame
  // --------------------------------------------------------
  function showFrame(n) {
    if (n < 0 || n >= frames.length) return;

    frames.forEach(f => f.classList.remove("active"));
    frames[n].classList.add("active");
    currentFrame = n;

    updateDots();
    onFrameEnter(n);
  }

  // --------------------------------------------------------
  // Update progress dots
  // --------------------------------------------------------
  function updateDots() {
    if (!dots.length) return;

    dots.forEach(dot => dot.classList.remove("active"));
    if (dots[currentFrame]) {
      dots[currentFrame].classList.add("active");
    }
  }

  // --------------------------------------------------------
  // Frame-specific behavior
  // --------------------------------------------------------
  function onFrameEnter(frameIndex) {
    
    // Hide Next on the first slide (frame 0) and the last slide (frame 6)
    if (nextBtn) {
    const isFirst = frameIndex === 0;
    const isLast = frameIndex === frames.length - 1;

    nextBtn.style.display = (isFirst || isLast) ? "none" : "inline-block";
}
    
    console.log(`Entered frame ${frameIndex}`);

    switch (frameIndex) {

        case 0:
            // Frame 0: Title slide
            break;

        case 1:
            // Frame 1: YOY employment chart
            break;

        case 2:
            // Frame 2: Industry grid selection
            break;

        case 3:
            // Frame 3: Recession profile visualization
            break;

        case 4:
            // Frame 4: Industry normalized view
            break;

        case 5:
            // Frame 5: Recovery comparison
            break;

        case 6:
            // Frame 6: Personalized wrap-up
            fillFinalTakeaway();
            break;
    }
  }

  // --------------------------------------------------------
  // Next button listener
  // --------------------------------------------------------
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentFrame < frames.length - 1) {
        showFrame(currentFrame + 1);
      }
    });
  }


  // --------------------------------------------------------
  // Dot click navigation
  // --------------------------------------------------------
  if (dots.length) {
    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        const index = parseInt(dot.dataset.dot, 10);
        if (!Number.isNaN(index)) {
          showFrame(index);
        }
      });
    });
  }

  // --------------------------------------------------------
  // Keyboard arrow navigation
  // --------------------------------------------------------
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" && nextBtn) {
      nextBtn.click();
    }
  });

  // --------------------------------------------------------
  // Restart button → go back to INDUSTRY SELECTION (Frame 2)
  // --------------------------------------------------------
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      // Frame index 2 = third frame = industry selection
      showFrame(2);
    });
  }

    // ----------------------------------------------------------
    // Start Exploring button (go from Frame 0 → Frame 1)
    // ----------------------------------------------------------
    const startButton = document.getElementById("start-exploring");

    if (startButton) {
    startButton.addEventListener("click", () => {
        showFrame(1); // first real content frame
     });
    }


  // --------------------------------------------------------
  // Personalized takeaway placeholder
  // --------------------------------------------------------
  function fillFinalTakeaway() {
    const takeawayEl = document.getElementById("final-personal-takeaway");
    if (!takeawayEl) return;

    // Example text
    takeawayEl.textContent =
      "Based on what you explored, your industry shows a unique recovery path. " +
      "Some sectors regained strength quickly, while others rebuilt slowly — " +
      "and yours carries a pattern shaped by both history and resilience.";
  }

  // --------------------------------------------------------
  // Start the slideshow
  // --------------------------------------------------------
  showFrame(0);
});

