// ==========================================================
// Slideshow Logic
// ==========================================================

window.addEventListener("DOMContentLoaded", () => {
  const frames = Array.from(document.querySelectorAll(".frame"));
  const dots = Array.from(document.querySelectorAll(".dot"));
  const nextBtn = document.getElementById("next");
  const backBtn = document.getElementById("back");
  const restartButton = document.getElementById("restart-button");
  const returnStartBtn = document.getElementById("return-start");

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

    // Determine first/last frame for ALL controls
    const isFirst = frameIndex === 0;
    const isLast = frameIndex === frames.length - 1;

    // Show/hide NEXT button
    if (nextBtn) {
      nextBtn.style.display = (isFirst || isLast) ? "none" : "inline-block";
    }

    // Show/hide RETURN TO START button
    if (returnStartBtn) {
      returnStartBtn.style.display = isLast ? "inline-block" : "none";
    }

    // Show/hide BACK button
    if (backBtn) {
      backBtn.style.visibility = isFirst ? "hidden" : "visible";
    }

    // Hide dots on frame 0
    const dotsContainer = document.getElementById("dots");
    if (dotsContainer) {
      dotsContainer.style.visibility = isFirst ? "hidden" : "visible";
    }

    console.log(`Entered frame ${frameIndex}`);

    switch (frameIndex) {
      case 6: // Last frame (Recovery comparison bar chart)
        renderRecoveryBarViz();
        break;
    }
  }

  // --------------------------------------------------------
  // Next button listener
  // --------------------------------------------------------
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {

      // Prevent leaving Frame 3 until industry is chosen
      if (currentFrame === 3) {
        const selectedIndustry = document.querySelector(".industry-btn.selected");
        if (!selectedIndustry) {
          alert("Please select an industry before continuing.");
          return;
        }
      }

      // Advance normally
      if (currentFrame < frames.length - 1) {
        showFrame(currentFrame + 1);
      }
    });
  }

  // --------------------------------------------------------
  // Back button listener
  // --------------------------------------------------------
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (currentFrame > 0) {
        showFrame(currentFrame - 1);
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
  // Keyboard navigation
  // --------------------------------------------------------
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" && nextBtn) {
      nextBtn.click();
    }
  });

  // --------------------------------------------------------
  // Restart button → go back to Industry Selection (Frame 3)
  // --------------------------------------------------------
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      showFrame(3);
    });
  }

  // --------------------------------------------------------
  // Return-to-Start button → go back to Frame 0
  // --------------------------------------------------------
  if (returnStartBtn) {
    returnStartBtn.addEventListener("click", () => {
      showFrame(0);
    });
  }

  // --------------------------------------------------------
  // Start Exploring button on Frame 0
  // --------------------------------------------------------
  const startButton = document.getElementById("start-exploring");

  if (startButton) {
    startButton.addEventListener("click", () => {
      showFrame(1);
    });
  }

  // --------------------------------------------------------
  // Start on Frame 0
  // --------------------------------------------------------
  showFrame(0);

});


