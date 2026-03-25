// Numberblocks Resource Hub Application Logic

document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('resource-list');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadMoreTrigger = document.getElementById('load-more-trigger');

    // State management
    let allData = window.initialData ? [...window.initialData] : [];

    // Core State
    let state = {
        mode: 'level', // level, grade, domain (Active filter mode)
        uiMode: 'level', // current mode shown in nav/sub-filters
        filter: 'all',  // specific id or 'all'
        search: '',
        displayCount: 10 // Initial items to show
    };

    // Filter Definitions
    const filterOptions = {
        level: [
            { id: 'all', label: '전체' },
            { id: 'step1', label: '🔴 Red (1단계)' },
            { id: 'step2', label: '🟠 Orange (2단계)' },
            { id: 'step3', label: '🟡 Yellow (3단계)' },
            { id: 'step4', label: '🟢 Green (4단계)' },
            { id: 'step5', label: '🔵 Blue/Violet (5단계+)' }
        ],
        grade: [
            { id: 'all', label: '전체' },
            { id: '유아 (3~5세)', label: '🐥 유아 (3~5세)' },
            { id: '유아 (5~6세)', label: '🎒 유아 (5~6세)' },
            { id: '유아~초등 1학년', label: '📚 유아~초1' },
            { id: '초등 1학년', label: '🏫 초등 1학년' },
            { id: '초등 1~2학년', label: '🏫 초등 1~2학년' },
            { id: '초등 2~3학년', label: '🚀 초등 2~3학년' },
            { id: '초등 3학년', label: '🎯 초등 3학년' }
        ],
        domain: [
            { id: 'all', label: '전체' },
            { id: 'number', label: '🔢 수와 연산' },
            { id: 'geometry', label: '🔺 도형' },
            { id: 'measurement', label: '📏 측정' },
            { id: 'pattern', label: '🧩 규칙성' },
            { id: 'data', label: '📊 자료' }
        ]
    };

    // Visited State
    const getVisited = () => JSON.parse(localStorage.getItem('nb_visited') || '[]');
    const AddVisited = (id) => {
        const visited = getVisited();
        if (!visited.includes(id)) {
            visited.push(id);
            localStorage.setItem('nb_visited', JSON.stringify(visited));
            // Update UI immediately
            const card = document.querySelector(`[data-id="${id}"]`);
            if (card) card.classList.add('visited');
        }
    };

    // DOM Elements
    const navModeBtns = document.querySelectorAll('.nav-mode-btn');
    const subFiltersContainer = document.getElementById('subFilters');

    // Mobile dropdown elements
    const mobileMode = document.getElementById('mobileMode');
    const mobileOption = document.getElementById('mobileOption');

    // Helper: Create Card Element
    function createCard(item) {
        const card = document.createElement('div');
        card.className = 'resource-card';
        card.setAttribute('data-id', item.id);

        if (getVisited().includes(item.id)) {
            card.classList.add('visited');
        }

        // Image section
        let imageHtml = '';
        if (item.img) {
            imageHtml = `<img src="${item.img}" alt="${item.title}" class="card-img" loading="lazy">`;
        }

        // Buttons for the expanded area
        let buttonsHtml = '';
        if (item.video) {
            buttonsHtml += `<a href="${item.video}" class="btn-action btn-video btn-en" target="_blank">영문 영상</a>`;
        }
        if (item.videoKr) {
            buttonsHtml += `<a href="${item.videoKr}" class="btn-action btn-video btn-kr" target="_blank">한글 영상</a>`;
        }
        if (item.link) {
            buttonsHtml += `<a href="${item.link}" class="btn-action btn-link btn-primary-link" target="_blank">원본 사이트 이동</a>`;
        }

        card.innerHTML = `
            <div class="card-main">
                ${imageHtml}
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div class="meta-info">
                        <span class="badge topic">${item.levelName || item.topic}</span>
                        <span class="badge grade">${item.korGrade || item.grade}</span>
                    </div>
                    <div class="usage-idea">${item.idea}</div>
                </div>
            </div>
            <div class="card-extra">
                <div class="btn-group">
                    ${buttonsHtml}
                </div>
            </div>
        `;

        // Add visited mark ONLY when a link inside is clicked
        card.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', () => {
                AddVisited(item.id);
            });
        });

        // Toggle Expand
        card.addEventListener('click', (e) => {
            // If click was on a button within card-extra, don't toggle
            if (e.target.closest('.card-extra')) return;

            const isExpanded = card.classList.contains('expanded');

            if (!isExpanded) {
                // Close other expanded cards
                const currentExpanded = document.querySelector('.resource-card.expanded');
                if (currentExpanded && currentExpanded !== card) {
                    currentExpanded.classList.remove('expanded');
                }
            }

            card.classList.toggle('expanded');
        });

        return card;
    }

    // Render Function
    function renderList(items) {
        listContainer.innerHTML = '';
        if (items.length === 0) {
            listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#888; font-size:1.1rem;">찾으시는 자료가 없어요 😢<br>다른 단어로 검색해보세요!</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        items.forEach(item => fragment.appendChild(createCard(item)));
        listContainer.appendChild(fragment);
    }

    // Filtering Logic
    function getFilteredData() {
        const query = searchInput.value.trim().toLowerCase();

        return allData.filter(item => {
            // 1. Text Search
            const matchesSearch = query === '' ||
                item.title.toLowerCase().includes(query) ||
                item.topic.toLowerCase().includes(query) ||
                item.idea.toLowerCase().includes(query);

            // 2. Category Filter
            let matchesCategory = true;
            if (state.filter !== 'all') {
                if (state.mode === 'level') {
                    matchesCategory = item.levelId === state.filter;
                } else if (state.mode === 'grade') {
                    // Match partial string for grade since it might contain "초등 1학년 (7~8세)"
                    matchesCategory = (item.korGrade || '').includes(state.filter);
                } else if (state.mode === 'domain') {
                    matchesCategory = item.domainId === state.filter;
                }
            }

            return matchesSearch && matchesCategory;
        });
    }

    function updateView() {
        state.displayCount = 10; // Reset count on filter change
        renderList(getFilteredData().slice(0, state.displayCount));
        updateLoadMoreBtn();
    }

    function updateLoadMoreBtn() {
        const totalFiltered = getFilteredData().length;
        if (state.displayCount >= totalFiltered) {
            loadMoreTrigger.style.display = 'none';
        } else {
            loadMoreTrigger.style.display = 'block';
            loadMoreTrigger.textContent = `더 보기 (${state.displayCount}/${totalFiltered})`;
        }
    }

    function loadMore() {
        state.displayCount += 10;
        const filtered = getFilteredData();
        renderList(filtered.slice(0, state.displayCount));
        updateLoadMoreBtn();
    }

    // Render Sub Filters based on Mode (Desktop)
    function renderSubFilters() {
        const options = filterOptions[state.uiMode];
        subFiltersContainer.innerHTML = options.map(opt => {
            // Only show active if the current active state matches both mode and filter
            const isActive = (state.mode === state.uiMode && state.filter === opt.id);
            return `
                <button class="sub-filter-btn ${isActive ? 'active' : ''}" 
                        data-id="${opt.id}">
                    ${opt.label}
                </button>
            `;
        }).join('');

        // Attach listeners
        subFiltersContainer.querySelectorAll('.sub-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.mode = state.uiMode; // Commit the navigation mode to active mode
                state.filter = btn.dataset.id;
                renderSubFilters(); // Re-render to update active class
                updateMobileDropdowns(); // Sync mobile dropdowns
                updateView();
            });
        });
    }

    // Update Mobile Dropdowns (populate options based on mode)
    function updateMobileDropdowns() {
        if (!mobileOption) return;

        const options = filterOptions[state.mode];
        mobileOption.innerHTML = options.map(opt =>
            `<option value="${opt.id}" ${state.filter === opt.id ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        // Update mode selector
        if (mobileMode) {
            mobileMode.value = state.mode;
        }
    }

    // Mode Switching (Desktop)
    navModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI
            navModeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update UI State ONLY (Don't update filter state or view yet)
            state.uiMode = btn.dataset.mode;

            renderSubFilters();
            // Removed updateView() to allow browsing without screen change
        });
    });

    // Mobile Mode Dropdown Change
    if (mobileMode) {
        mobileMode.addEventListener('change', (e) => {
            state.mode = e.target.value;
            state.uiMode = e.target.value;
            state.filter = 'all'; // Reset to "전체" when mode changes

            // Update desktop buttons
            navModeBtns.forEach(btn => {
                if (btn.dataset.mode === state.mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            renderSubFilters();
            updateMobileDropdowns();
            updateView();
        });
    }

    // Mobile Option Dropdown Change
    if (mobileOption) {
        mobileOption.addEventListener('change', (e) => {
            state.filter = e.target.value;
            renderSubFilters(); // Update desktop sub-filters
            updateView();
        });
    }

    // Sub Filter Logic is handled in renderSubFilters

    // Search Events
    const searchContainer = document.querySelector('.search-container');
    const searchCloseBtn = document.getElementById('searchCloseBtn');

    searchBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            // Mobile: Full-screen overlay search
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) {
                searchInput.focus();
            }
        } else {
            // Desktop: Expandable search bar
            if (!searchContainer.classList.contains('active')) {
                searchContainer.classList.add('active');
                searchInput.focus();
            } else if (searchInput.value.trim() === '') {
                // If empty and already active, collapse it
                searchContainer.classList.remove('active');
                searchInput.blur();
            } else {
                // If has value, update view (trigger search)
                updateView();
            }
        }
    });

    // Close button for mobile search
    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchInput.classList.remove('active');
            searchContainer.classList.remove('active'); // Desktop sync
            searchInput.value = '';
            updateView();
        });
    }

    searchInput.addEventListener('input', updateView);

    // Load More Button
    loadMoreTrigger.addEventListener('click', loadMore);

    // Drag Scroll for Sub Filters
    let isDown = false;
    let startX;
    let scrollLeft;

    subFiltersContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - subFiltersContainer.offsetLeft;
        scrollLeft = subFiltersContainer.scrollLeft;
    });

    subFiltersContainer.addEventListener('mouseleave', () => {
        isDown = false;
    });

    subFiltersContainer.addEventListener('mouseup', () => {
        isDown = false;
    });

    subFiltersContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - subFiltersContainer.offsetLeft;
        const walk = (x - startX) * 2;
        subFiltersContainer.scrollLeft = scrollLeft - walk;
    });

    // Infinite Scroll with IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const totalFiltered = getFilteredData().length;
                if (state.displayCount < totalFiltered) {
                    loadMore();
                }
            }
        });
    }, {
        root: null,
        rootMargin: '100px', // Load before fully visible
        threshold: 0.1
    });

    observer.observe(loadMoreTrigger);

    // Initial Load
    renderSubFilters();
    updateMobileDropdowns(); // Initialize mobile dropdowns
    updateView();

    fetch('data-content.json')
        .then(res => res.json())
        .then(data => {
            // Merge unique items if needed, or just replace/append
            // Simple approach: Replace initial data with full data
            allData = data;
            updateView();
        })
        .catch(err => console.log('Fetch error:', err));
});

