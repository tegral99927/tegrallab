document.addEventListener("DOMContentLoaded", function () {
    // フッターを読み込む
    fetch('/parts/footer.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            // フッターを表示する場所を探す
            const footerPlaceholder = document.getElementById('global-footer');

            if (footerPlaceholder) {
                // プレースホルダーがある場合はそこに書き込む
                footerPlaceholder.innerHTML = data;
            } else {
                // プレースホルダーがない場合はbodyの最後に挿入する
                document.body.insertAdjacentHTML('beforeend', data);
            }
        })
        .catch(error => {
            console.error('Error loading footer:', error);
        });
});
