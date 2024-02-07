/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Set the search input value to the query parameter.
  const searchInput = document.getElementById('search-input');
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("q");
  if (q) {
    searchInput.value = q;
  }

  // Add the active class to the search menu link.
  const menuLinks = document.querySelectorAll('.menu-link');

  ['/search', '/search/images', '/search/audio'].forEach(path => {
    if (window.location.pathname === path) {
      menuLinks.forEach(link => {
        if (link.getAttribute('href') === path) {
          link.classList.add('active');
        }
        link.setAttribute('href', `${link.getAttribute('href')}?q=${q}`);
      });
    }
  });
});