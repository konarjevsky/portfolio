(() => {
  "use strict";

  const content = window.PORTFOLIO_CONTENT;
  if (!content) return;

  const profile = content.profile;
  const posts = [...content.posts].sort(
    (a, b) => new Date(b.sortDate) - new Date(a.sortDate)
  );

  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const setText = (selector, text) => {
    const element = one(selector);
    if (element) element.textContent = text;
  };

  setText("[data-name]", profile.name);
  setText("[data-role]", profile.role);
  setText("[data-education]", profile.education);
  setText("[data-specialization]", profile.specialization);
  setText("[data-year]", new Date().getFullYear());
  document.title = `${profile.name} — ${profile.role}`;

  const heroImage = one("[data-hero-image]");
  heroImage.src = profile.portrait;
  heroImage.alt = profile.portraitAlt;

  const about = one("[data-about]");
  about.replaceChildren();
  profile.about.forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    about.append(p);
  });

  const contactLink = one("[data-email]");
  contactLink.href = `mailto:${profile.email}`;
  contactLink.textContent = profile.contactLabel || "Написать";

  const footerEmail = one("[data-footer-email]");
  footerEmail.href = `mailto:${profile.email}`;
  footerEmail.textContent = profile.email;

  const socials = one("[data-socials]");
  socials.replaceChildren();
  content.socials.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.label;
    link.target = "_blank";
    link.rel = "noreferrer";
    socials.append(link);
  });

  const filters = one("[data-filters]");
  const projects = one("[data-projects]");
  const categories = ["Все работы", ...new Set(posts.map((post) => post.category))];
  let activeCategory = "Все работы";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter";
    button.textContent = category;
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      all(".filter", filters).forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderProjects();
    });
    filters.append(button);
  });

  const createGallery = (post, postIndex) => {
    const gallery = document.createElement("div");
    gallery.className = "project__gallery";

    const maximumCount = Math.min(post.images.length, 3);
    const requestedCount = Number(post.previewCount);
    const hasManualCount = Number.isInteger(requestedCount) && requestedCount > 0;
    const initialCount = hasManualCount
      ? Math.min(requestedCount, maximumCount)
      : maximumCount;
    let autoLayoutResolved = hasManualCount;

    const renderImages = (count) => {
      gallery.replaceChildren();
      gallery.dataset.count = count;

      post.images.slice(0, count).forEach((image, imageIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "project__image-button";
        button.setAttribute(
          "aria-label",
          `Открыть фото ${imageIndex + 1} проекта «${post.title}»`
        );

        const img = document.createElement("img");
        img.alt = image.alt;
        img.loading = !hasManualCount && imageIndex === 0 ? "eager" : "lazy";
        img.decoding = "async";
        img.style.objectFit = post.imageFit || "cover";
        img.style.objectPosition = post.imagePosition || "center";

        img.addEventListener("load", () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          button.style.setProperty(
            "--image-ratio",
            `${img.naturalWidth} / ${img.naturalHeight}`
          );

          if (imageIndex !== 0) return;

          const orientation = ratio >= 1.25
            ? "wide"
            : ratio <= 0.8
              ? "portrait"
              : "square";
          gallery.dataset.firstOrientation = orientation;

          if (orientation === "wide") {
            gallery.style.setProperty(
              "--wide-limit",
              `${ratio * 68}svh`
            );
          }

          if (!autoLayoutResolved) {
            autoLayoutResolved = true;
            const automaticCount = orientation === "wide" ? 1 : maximumCount;
            if (automaticCount !== count) renderImages(automaticCount);
          }
        });

        img.src = image.src;
        button.append(img);
        button.addEventListener("click", () => openLightbox(postIndex, imageIndex));
        gallery.append(button);
      });
    };

    renderImages(initialCount);

    return gallery;
  };

  const renderProjects = () => {
    const filtered = posts.filter(
      (post) => activeCategory === "Все работы" || post.category === activeCategory
    );
    projects.replaceChildren();

    filtered.forEach((post) => {
      const postIndex = posts.indexOf(post);
      const article = document.createElement("article");
      article.className = "project";

      const gallery = createGallery(post, postIndex);
      const info = document.createElement("div");
      info.className = "project__info section-pad";
      info.innerHTML = `
        <div class="project__meta">
          <p>${post.category}</p>
          <p>${post.date}</p>
        </div>
        <h3>${post.title}</h3>
        <p class="project__description">${post.description}</p>
        <button class="project__open" type="button">
          Смотреть все фотографии
          <span>${post.images.length}</span>
        </button>
      `;

      one(".project__open", info).addEventListener("click", () => {
        openLightbox(postIndex, 0);
      });

      article.append(gallery, info);
      projects.append(article);
    });

    requestAnimationFrame(() => {
      all(".project", projects).forEach((project) => project.classList.add("is-visible"));
    });
  };

  const lightbox = one("[data-lightbox]");
  const lightboxImage = one("[data-lightbox-image]");
  const lightboxStage = one("[data-lightbox-stage]");
  const thumbnails = one("[data-lightbox-thumbnails]");
  const zoomValue = one("[data-lightbox-zoom-value]");
  const zoomOutButton = one("[data-lightbox-zoom-out]");
  const zoomInButton = one("[data-lightbox-zoom-in]");

  let currentPost = 0;
  let currentImage = 0;
  let zoomLevel = 1;

  const applyZoom = () => {
    lightboxStage.classList.toggle("is-zoomed", zoomLevel > 1);
    lightboxImage.style.width = `${zoomLevel * 100}%`;
    lightboxImage.style.height = `${zoomLevel * 100}%`;
    zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
    zoomOutButton.disabled = zoomLevel <= 0.5;
    zoomInButton.disabled = zoomLevel >= 3;

    if (zoomLevel === 1) {
      lightboxStage.scrollTo({ top: 0, left: 0 });
    } else {
      requestAnimationFrame(() => {
        lightboxStage.scrollTo({
          top: (lightboxStage.scrollHeight - lightboxStage.clientHeight) / 2,
          left: (lightboxStage.scrollWidth - lightboxStage.clientWidth) / 2
        });
      });
    }
  };

  const setZoom = (nextZoom) => {
    zoomLevel = Math.min(3, Math.max(0.5, nextZoom));
    applyZoom();
  };

  const renderThumbnails = () => {
    const post = posts[currentPost];
    thumbnails.replaceChildren();

    post.images.forEach((image, imageIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lightbox__thumbnail";
      button.setAttribute("aria-label", `Показать фото ${imageIndex + 1}`);
      button.setAttribute("aria-pressed", String(imageIndex === currentImage));

      const img = document.createElement("img");
      img.src = image.src;
      img.alt = "";
      img.loading = "eager";
      button.append(img);
      button.addEventListener("click", () => {
        currentImage = imageIndex;
        updateLightbox();
      });
      thumbnails.append(button);
    });
  };

  const updateLightbox = () => {
    const post = posts[currentPost];
    const image = post.images[currentImage];
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    setText("[data-lightbox-title]", post.title);
    setText("[data-lightbox-meta]", `${post.category} · ${post.date}`);
    setText(
      "[data-lightbox-count]",
      `${currentImage + 1} / ${post.images.length}`
    );
    setZoom(1);
    renderThumbnails();
  };

  const openLightbox = (postIndex, imageIndex) => {
    currentPost = postIndex;
    currentImage = imageIndex;
    updateLightbox();
    lightbox.showModal();
    document.body.classList.add("is-locked");
  };

  const closeLightbox = () => {
    lightbox.close();
    document.body.classList.remove("is-locked");
  };

  const stepImage = (direction) => {
    const length = posts[currentPost].images.length;
    currentImage = (currentImage + direction + length) % length;
    updateLightbox();
  };

  one("[data-lightbox-close]").addEventListener("click", closeLightbox);
  one("[data-lightbox-prev]").addEventListener("click", () => stepImage(-1));
  one("[data-lightbox-next]").addEventListener("click", () => stepImage(1));
  zoomOutButton.addEventListener("click", () => setZoom(zoomLevel - 0.5));
  zoomInButton.addEventListener("click", () => setZoom(zoomLevel + 0.5));
  lightboxImage.addEventListener("dblclick", () => {
    setZoom(zoomLevel === 1 ? 2 : 1);
  });
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox.addEventListener("close", () => {
    document.body.classList.remove("is-locked");
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "ArrowLeft") stepImage(-1);
    if (event.key === "ArrowRight") stepImage(1);
    if (event.key === "+" || event.key === "=") setZoom(zoomLevel + 0.5);
    if (event.key === "-") setZoom(zoomLevel - 0.5);
  });

  const header = one("[data-header]");
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  renderProjects();
})();
