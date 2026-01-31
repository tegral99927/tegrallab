document.addEventListener("DOMContentLoaded", function () {
    // ヘッダーを読み込む
    fetch('/parts/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            // ヘッダーを表示する場所を探す
            const headerPlaceholder = document.getElementById('global-header');

            if (headerPlaceholder) {
                // プレースホルダーがある場合はそこに書き込む
                headerPlaceholder.innerHTML = data;
            } else {
                // プレースホルダーがない場合はbodyの先頭に挿入する
                document.body.insertAdjacentHTML('afterbegin', data);
            }

            // ハンバーガーメニューの動作設定
            const toggleBtn = document.querySelector('.menu-toggle');
            const navLinks = document.querySelector('.nav-links');

            if (toggleBtn && navLinks) {
                toggleBtn.addEventListener('click', function () {
                    toggleBtn.classList.toggle('active');
                    navLinks.classList.toggle('active');

                    // メニューが開いているときはスクロールを無効化
                    if (navLinks.classList.contains('active')) {
                        document.body.style.overflow = 'hidden';
                    } else {
                        document.body.style.overflow = '';
                    }
                });

                // リンクをクリックしたらメニューを閉じる
                const links = navLinks.querySelectorAll('a');
                links.forEach(link => {
                    link.addEventListener('click', () => {
                        toggleBtn.classList.remove('active');
                        navLinks.classList.remove('active');
                        document.body.style.overflow = '';
                    });
                });
            }
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });
});
