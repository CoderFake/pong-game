/**
 * File: static/js/pong-game.js
 * Mô tả: Xử lý logic game Pong và tích hợp AI
 */

class PongGame {
    constructor(canvasId, options = {}) {
        if (this.options.enablePowerups) {
            this.powerupManager = new PowerupManager(this);
        }
        // Khởi tạo canvas và context
        this.lastBallPosition = { x: 0, y: 0 };
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Các tùy chọn game
        this.options = {
            width: options.width || 800,
            height: options.height || 500,
            paddleWidth: options.paddleWidth || 15,
            paddleHeight: options.paddleHeight || 100,
            ballSize: options.ballSize || 10,
            maxScore: options.maxScore || 5,
            enablePowerups: options.enablePowerups || false,
            ballSpeed: options.ballSpeed || 1.0,
            paddleSpeed: options.paddleSpeed || 5,
            aiEnabled: options.aiEnabled || false,
            aiDifficulty: options.aiDifficulty || 'medium',
            gameId: options.gameId || null,
            isTournament: options.isTournament || false,
            wsUrl: options.wsUrl || null,
        };

        // Kích thước canvas
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;

        // Trạng thái game
        this.resetGame();

        // WebSocket cho multiplayer
        this.ws = null;
        if (this.options.wsUrl) {
            this.setupWebSocket();
        }

        // Thiết lập sự kiện
        this.setupEvents();

        // Game loop
        this.lastTime = 0;
        this.animate = this.animate.bind(this);
    }

    // Khởi tạo lại trạng thái game
    resetGame() {

        if (this.aiActive) {
            this.ai = new PongAI({
                difficulty: this.options.aiDifficulty,
                paddleHeight: this.options.paddleHeight,
                initialY: this.rightPaddle.y,
                fieldHeight: this.options.height,
                fieldWidth: this.options.width
            });
        }

        if (this.options.enablePowerups && this.powerupManager) {
            this.powerupManager.reset();
        }

        // Vị trí và kích thước các đối tượng
        this.leftPaddle = {
            x: 20,
            y: this.options.height / 2 - this.options.paddleHeight / 2,
            width: this.options.paddleWidth,
            height: this.options.paddleHeight,
            score: 0,
            speed: this.options.paddleSpeed,
            moving: 0, // -1: lên, 0: đứng yên, 1: xuống
            color: '#FFFFFF',
            ready: false,
            connected: true
        };

        this.rightPaddle = {
            x: this.options.width - 20 - this.options.paddleWidth,
            y: this.options.height / 2 - this.options.paddleHeight / 2,
            width: this.options.paddleWidth,
            height: this.options.paddleHeight,
            score: 0,
            speed: this.options.paddleSpeed,
            moving: 0,
            color: '#FFFFFF',
            ready: false,
            connected: true
        };

        // Trạng thái bóng
        this.ball = {
            x: this.options.width / 2,
            y: this.options.height / 2,
            size: this.options.ballSize,
            speedX: 5 * this.options.ballSpeed,
            speedY: (Math.random() * 4 - 2) * this.options.ballSpeed,
            color: '#FFFFFF'
        };

        // Đổi hướng bóng ngẫu nhiên
        if (Math.random() > 0.5) this.ball.speedX *= -1;

        // Trạng thái game
        this.gameState = {
            running: false,
            paused: false,
            countdown: 3,
            message: "Nhấn SPACE để bắt đầu",
            lastUpdate: Date.now(),
            finished: false
        };

        // Lập trình AI (nếu kích hoạt)
        this.aiActive = this.options.aiEnabled;
        this.aiLastUpdate = 0;

        // Power-ups (nếu kích hoạt)
        this.powerups = [];
        if (this.options.enablePowerups) {
            this.setupPowerups();
        }
    }

    // Thiết lập WebSocket cho multiplayer
    setupWebSocket() {
        this.ws = new WebSocket(this.options.wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket kết nối thành công');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket đã đóng kết nối');
            this.gameState.message = "Mất kết nối với server";
            this.gameState.paused = true;
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket lỗi:', error);
        };
    }

    // Xử lý tin nhắn từ WebSocket
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'game_update':
                // Cập nhật trạng thái game từ server
                this.updateGameFromServer(data.game_state);
                break;

            case 'paddle_move':
                // Cập nhật vị trí paddle của đối phương
                if (data.user_id !== userId) { // userId là ID người chơi hiện tại
                    const paddle = this.getOpponentPaddle();
                    paddle.y = data.y_position;
                }
                break;

            case 'goal_scored':
                // Cập nhật điểm số khi có bàn thắng
                this.leftPaddle.score = data.left_score;
                this.rightPaddle.score = data.right_score;
                this.checkGameOver();
                this.resetBall();
                break;

            case 'player_status':
                // Cập nhật trạng thái kết nối của người chơi
                if (data.user_id === leftUserId) {
                    this.leftPaddle.connected = data.connected;
                } else if (data.user_id === rightUserId) {
                    this.rightPaddle.connected = data.connected;
                }

                if (!data.connected) {
                    this.gameState.message = "Đối thủ đã ngắt kết nối";
                    this.gameState.paused = true;
                }
                break;

            case 'player_ready':
                // Cập nhật trạng thái sẵn sàng của người chơi
                if (data.user_id === leftUserId) {
                    this.leftPaddle.ready = true;
                } else if (data.user_id === rightUserId) {
                    this.rightPaddle.ready = true;
                }
                break;

            case 'all_ready':
                // Tất cả người chơi đã sẵn sàng, bắt đầu game
                this.startGame();
                break;
        }
    }

    // Thiết lập sự kiện bàn phím
    setupEvents() {
        // Sự kiện nhấn phím
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Sự kiện thả phím
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
    }

    // Xử lý sự kiện nhấn phím
    handleKeyDown(e) {
        if (this.gameState.finished) return;

        switch (e.key) {
            case 'w':
            case 'W':
                // Di chuyển paddle trái lên
                this.leftPaddle.moving = -1;
                break;

            case 's':
            case 'S':
                // Di chuyển paddle trái xuống
                this.leftPaddle.moving = 1;
                break;

            case 'ArrowUp':
                // Di chuyển paddle phải lên (nếu không phải AI)
                if (!this.aiActive) {
                    this.rightPaddle.moving = -1;
                }
                break;

            case 'ArrowDown':
                // Di chuyển paddle phải xuống (nếu không phải AI)
                if (!this.aiActive) {
                    this.rightPaddle.moving = 1;
                }
                break;

            case ' ':
                // Bắt đầu game
                if (!this.gameState.running && !this.gameState.paused) {
                    if (this.ws) {
                        // Gửi thông báo sẵn sàng cho server
                        this.ws.send(JSON.stringify({
                            type: 'game_ready'
                        }));
                    } else {
                        this.startGame();
                    }
                } else if (this.gameState.paused) {
                    this.gameState.paused = false;
                    this.gameState.message = "";
                }
                break;
        }

        // Nếu có WebSocket, gửi vị trí paddle lên server
        if (this.ws && this.gameState.running) {
            this.sendPaddlePosition();
        }
    }

    // Xử lý sự kiện thả phím
    handleKeyUp(e) {
        switch (e.key) {
            case 'w':
            case 'W':
                if (this.leftPaddle.moving === -1) this.leftPaddle.moving = 0;
                break;

            case 's':
            case 'S':
                if (this.leftPaddle.moving === 1) this.leftPaddle.moving = 0;
                break;

            case 'ArrowUp':
                if (!this.aiActive && this.rightPaddle.moving === -1) this.rightPaddle.moving = 0;
                break;

            case 'ArrowDown':
                if (!this.aiActive && this.rightPaddle.moving === 1) this.rightPaddle.moving = 0;
                break;
        }

        // Nếu có WebSocket, gửi vị trí paddle lên server
        if (this.ws && this.gameState.running) {
            this.sendPaddlePosition();
        }
    }

    // Gửi vị trí paddle lên server
    sendPaddlePosition() {
        const paddle = document.getElementById('user-side').value === 'left' ? this.leftPaddle : this.rightPaddle;
        this.ws.send(JSON.stringify({
            type: 'paddle_move',
            y_position: paddle.y,
            timestamp: Date.now()
        }));
    }

    // Bắt đầu game
    startGame() {
        this.gameState.running = true;
        this.gameState.paused = false;
        this.gameState.message = "";
        this.gameState.countdown = 3;
        this.startCountdown();
    }

    // Đếm ngược trước khi bắt đầu
    startCountdown() {
        this.gameState.message = this.gameState.countdown.toString();
        const countdownInterval = setInterval(() => {
            this.gameState.countdown--;

            if (this.gameState.countdown <= 0) {
                clearInterval(countdownInterval);
                this.gameState.message = "";
                this.ball.speedX = (this.ball.speedX > 0 ? 1 : -1) * 5 * this.options.ballSpeed;
                this.ball.speedY = (Math.random() * 4 - 2) * this.options.ballSpeed;
                requestAnimationFrame(this.animate);
            } else {
                this.gameState.message = this.gameState.countdown.toString();
            }
        }, 1000);
    }

    // Game loop
    animate(timestamp) {
        // Tính toán delta time
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Xóa canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Vẽ background
        this.drawBackground();

        // Cập nhật và vẽ các đối tượng
        if (this.gameState.running && !this.gameState.paused) {
            this.update(deltaTime);
        }

        this.draw();

        // Vẽ giao diện
        this.drawUI();

        // Tiếp tục game loop
        if (!this.gameState.finished) {
            requestAnimationFrame(this.animate);
        }
    }

    // Cập nhật vị trí các đối tượng
    update(deltaTime) {
        if (this.options.enablePowerups && this.powerupManager) {
            this.powerupManager.update(deltaTime);
        }
        // Di chuyển paddle trái
        if (this.leftPaddle.moving === -1) {
            this.leftPaddle.y -= this.leftPaddle.speed;
        } else if (this.leftPaddle.moving === 1) {
            this.leftPaddle.y += this.leftPaddle.speed;
        }

        // Giới hạn vị trí paddle trái
        this.leftPaddle.y = Math.max(0, Math.min(this.options.height - this.leftPaddle.height, this.leftPaddle.y));

        // Di chuyển paddle phải (nếu không phải AI)
        if (!this.aiActive) {
            if (this.rightPaddle.moving === -1) {
                this.rightPaddle.y -= this.rightPaddle.speed;
            } else if (this.rightPaddle.moving === 1) {
                this.rightPaddle.y += this.rightPaddle.speed;
            }
        } else {
            // Cập nhật vị trí AI (chỉ cập nhật 1 lần/giây để mô phỏng thời gian phản ứng của con người)
            const currentTime = Date.now();
            if (currentTime - this.aiLastUpdate >= 1000) {
                this.updateAI();
                this.aiLastUpdate = currentTime;
            }
        }

        // Giới hạn vị trí paddle phải
        this.rightPaddle.y = Math.max(0, Math.min(this.options.height - this.rightPaddle.height, this.rightPaddle.y));

        // Di chuyển bóng
        this.ball.x += this.ball.speedX;
        this.ball.y += this.ball.speedY;

        // Kiểm tra va chạm với tường trên/dưới
        if (this.ball.y <= this.ball.size || this.ball.y >= this.options.height - this.ball.size) {
            this.ball.speedY *= -1;
            // Thêm một chút ngẫu nhiên để tránh lặp lại quỹ đạo
            this.ball.speedY += (Math.random() * 0.4 - 0.2);
        }

        // Kiểm tra va chạm với paddle trái
        if (this.ball.x - this.ball.size <= this.leftPaddle.x + this.leftPaddle.width &&
            this.ball.y >= this.leftPaddle.y &&
            this.ball.y <= this.leftPaddle.y + this.leftPaddle.height &&
            this.ball.speedX < 0) {

            // Tính toán góc nảy dựa trên vị trí va chạm
            const hitPosition = (this.ball.y - this.leftPaddle.y) / this.leftPaddle.height;
            const angle = (hitPosition - 0.5) * Math.PI * 0.7; // -35 đến 35 độ

            // Điều chỉnh hướng và tốc độ
            const speed = Math.sqrt(this.ball.speedX * this.ball.speedX + this.ball.speedY * this.ball.speedY);
            this.ball.speedX = Math.cos(angle) * speed * 1.05; // Tăng tốc độ mỗi lần nảy
            this.ball.speedY = Math.sin(angle) * speed * 1.05;
        }

        // Kiểm tra va chạm với paddle phải
        if (this.ball.x + this.ball.size >= this.rightPaddle.x &&
            this.ball.y >= this.rightPaddle.y &&
            this.ball.y <= this.rightPaddle.y + this.rightPaddle.height &&
            this.ball.speedX > 0) {

            // Tính toán góc nảy dựa trên vị trí va chạm
            const hitPosition = (this.ball.y - this.rightPaddle.y) / this.rightPaddle.height;
            const angle = (hitPosition - 0.5) * Math.PI * 0.7 + Math.PI; // 145 đến 215 độ

            // Điều chỉnh hướng và tốc độ
            const speed = Math.sqrt(this.ball.speedX * this.ball.speedX + this.ball.speedY * this.ball.speedY);
            this.ball.speedX = Math.cos(angle) * speed * 1.05;
            this.ball.speedY = Math.sin(angle) * speed * 1.05;
        }

        // Kiểm tra bàn thắng (bóng ra ngoài biên trái/phải)
        if (this.ball.x < 0) {
            // Điểm cho bên phải
            this.rightPaddle.score++;

            if (this.ws) {
                this.ws.send(JSON.stringify({
                    type: 'goal_scored',
                    scoring_side: 'right',
                    left_score: this.leftPaddle.score,
                    right_score: this.rightPaddle.score
                }));
            }

            // Kiểm tra kết thúc game
            if (this.rightPaddle.score >= this.options.maxScore) {
                this.endGame('right');
            } else {
                this.resetBall();
            }
        } else if (this.ball.x > this.options.width) {
            // Điểm cho bên trái
            this.leftPaddle.score++;

            if (this.ws) {
                this.ws.send(JSON.stringify({
                    type: 'goal_scored',
                    scoring_side: 'left',
                    left_score: this.leftPaddle.score,
                    right_score: this.rightPaddle.score
                }));
            }

            // Kiểm tra kết thúc game
            if (this.leftPaddle.score >= this.options.maxScore) {
                this.endGame('left');
            } else {
                this.resetBall();
            }
        }

        // Cập nhật power-ups (nếu kích hoạt)
        if (this.options.enablePowerups) {
            this.updatePowerups();
        }
    }

    // Cập nhật AI
    updateAI() {
        const currentTime = Date.now();

        // Gọi hàm update của AI
        this.rightPaddle.y = this.ai.update(
            this.ball.x,
            this.ball.y,
            this.ball.speedX,
            this.ball.speedY,
            currentTime
        );

        // Ghi nhận va chạm và bỏ lỡ cho AI học tập
        if (this.lastBallPosition.x > this.ball.x && this.ball.x > this.options.width / 2) {
            // Bóng đang đi về phía phải và đã qua giữa sân
            if (this.ball.speedX < 0) {
                // Bóng vừa nảy lại, nghĩa là AI đã đánh trúng
                this.ai.recordHit();
            }
        }

        // Nếu bóng đã ra ngoài biên phải, AI bỏ lỡ
        if (this.ball.x > this.options.width) {
            this.ai.recordMiss();
        }

        // Lưu vị trí bóng để kiểm tra va chạm
        this.lastBallPosition = {
            x: this.ball.x,
            y: this.ball.y
        };
    }
    // Đặt lại vị trí bóng
    resetBall() {
        this.ball.x = this.options.width / 2;
        this.ball.y = this.options.height / 2;

        // Chọn hướng ngẫu nhiên
        this.ball.speedX = (Math.random() > 0.5 ? 1 : -1) * 5 * this.options.ballSpeed;
        this.ball.speedY = (Math.random() * 4 - 2) * this.options.ballSpeed;

        // Tạm dừng một chút trước khi bắt đầu lại
        this.gameState.paused = true;
        this.gameState.message = "3";

        let countdown = 3;
        const countdownInterval = setInterval(() => {
            countdown--;

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.gameState.paused = false;
                this.gameState.message = "";
            } else {
                this.gameState.message = countdown.toString();
            }
        }, 1000);
    }

    // Kết thúc game
    endGame(winner) {
        this.gameState.finished = true;

        if (winner === 'left') {
            this.gameState.message = "Người chơi bên trái thắng!";
        } else {
            this.gameState.message = "Người chơi bên phải thắng!";
        }

        // Gửi thông báo kết thúc game lên server (nếu có WebSocket)
        if (this.ws && this.options.gameId) {
            fetch(`/api/game/games/${this.options.gameId}/finish/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    winner: winner
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Kết quả game đã được lưu:', data);

                // Hiển thị nút "Trở về"
                setTimeout(() => {
                    this.showReturnButton();
                }, 2000);
            })
            .catch(error => {
                console.error('Lỗi khi lưu kết quả game:', error);
            });
        } else {
            // Hiển thị nút "Trở về" nếu không có WebSocket
            setTimeout(() => {
                this.showReturnButton();
            }, 2000);
        }
    }

    // Hiển thị nút "Trở về"
    showReturnButton() {
        const returnButton = document.createElement('button');
        returnButton.innerText = "Trở về";
        returnButton.className = "btn btn-primary mt-3";
        returnButton.onclick = () => {
            window.location.href = "/";
        };

        const container = document.querySelector('.game-container');
        container.appendChild(returnButton);
    }

    // Vẽ background
    drawBackground() {
        // Vẽ nền đen
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Vẽ đường giữa
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.options.width / 2, 0);
        this.ctx.lineTo(this.options.width / 2, this.options.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    // Vẽ các đối tượng trong game
    draw() {
        if (this.options.enablePowerups && this.powerupManager) {
            this.powerupManager.drawPowerups(this.ctx);
        }
        // Vẽ paddle trái
        this.ctx.fillStyle = this.leftPaddle.color;
        this.ctx.fillRect(this.leftPaddle.x, this.leftPaddle.y, this.leftPaddle.width, this.leftPaddle.height);

        // Vẽ paddle phải
        this.ctx.fillStyle = this.rightPaddle.color;
        this.ctx.fillRect(this.rightPaddle.x, this.rightPaddle.y, this.rightPaddle.width, this.rightPaddle.height);

        // Vẽ bóng
        this.ctx.fillStyle = this.ball.color;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.size, 0, Math.PI * 2);
        this.ctx.fill();

        // Vẽ power-ups (nếu kích hoạt)
        if (this.options.enablePowerups) {
            this.drawPowerups();
        }
    }

    // Vẽ giao diện người dùng
    drawUI() {
        // Vẽ điểm số
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';

        // Điểm người chơi bên trái
        this.ctx.fillText(this.leftPaddle.score.toString(), this.options.width / 4, 50);

        // Điểm người chơi bên phải
        this.ctx.fillText(this.rightPaddle.score.toString(), this.options.width * 3 / 4, 50);

        // Vẽ thông báo
        if (this.gameState.message) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(this.options.width / 2 - 150, this.options.height / 2 - 30, 300, 60);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.gameState.message, this.options.width / 2, this.options.height / 2 + 10);
        }

        // Hiển thị thông báo power-up
        if (this.powerupMessage && Date.now() - this.powerupMessage.time < this.powerupMessage.duration) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(this.options.width / 2 - 150, 20, 300, 40);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.powerupMessage.text, this.options.width / 2, 45);
        }


        // Vẽ chỉ dẫn nếu game chưa bắt đầu
        if (!this.gameState.running && !this.gameState.finished) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';

            if (this.aiActive) {
                this.ctx.fillText("W/S: Di chuyển paddle", this.options.width / 2, this.options.height - 50);
            } else {
                this.ctx.fillText("W/S: Paddle trái | ↑/↓: Paddle phải", this.options.width / 2, this.options.height - 50);
            }

            this.ctx.fillText("SPACE: Bắt đầu", this.options.width / 2, this.options.height - 30);
        }

        // Hiển thị trạng thái kết nối của người chơi
        if (!this.leftPaddle.connected) {
            this.ctx.fillStyle = 'red';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Mất kết nối", this.options.width / 4, 70);
        }

        if (!this.rightPaddle.connected) {
            this.ctx.fillStyle = 'red';
            this.ctx.font = '12px Arial';
            this.ctx.fillStyle = 'red';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Mất kết nối", this.options.width * 3 / 4, 70);
        }
    }

    // Thiết lập power-ups
    setupPowerups() {
        this.powerupTypes = [
            {
                name: 'paddleSize',
                color: '#00FF00',
                duration: 5000,
                effect: (player) => {
                    const paddle = player === 'left' ? this.leftPaddle : this.rightPaddle;
                    const originalHeight = paddle.height;
                    paddle.height *= 1.5;

                    setTimeout(() => {
                        paddle.height = originalHeight;
                    }, 5000);
                }
            },
            {
                name: 'ballSpeed',
                color: '#FF0000',
                duration: 5000,
                effect: () => {
                    const originalSpeedX = this.ball.speedX;
                    const originalSpeedY = this.ball.speedY;

                    this.ball.speedX *= 1.5;
                    this.ball.speedY *= 1.5;

                    setTimeout(() => {
                        this.ball.speedX = originalSpeedX;
                        this.ball.speedY = originalSpeedY;
                    }, 5000);
                }
            },
            {
                name: 'paddleSpeed',
                color: '#0000FF',
                duration: 5000,
                effect: (player) => {
                    const paddle = player === 'left' ? this.leftPaddle : this.rightPaddle;
                    const originalSpeed = paddle.speed;
                    paddle.speed *= 1.5;

                    setTimeout(() => {
                        paddle.speed = originalSpeed;
                    }, 5000);
                }
            }
        ];

        // Tạo power-up mỗi 10 giây
        this.powerupInterval = setInterval(() => {
            if (this.gameState.running && !this.gameState.paused && this.powerups.length < 3) {
                this.createPowerup();
            }
        }, 10000);
    }

    // Tạo power-up mới
    createPowerup() {
        const type = this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)];

        const powerup = {
            x: Math.random() * (this.options.width - 100) + 50,
            y: Math.random() * (this.options.height - 100) + 50,
            radius: 10,
            type: type,
            active: true
        };

        this.powerups.push(powerup);
    }

    // Cập nhật power-ups
    updatePowerups() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];

            // Kiểm tra va chạm với bóng
            const dx = powerup.x - this.ball.x;
            const dy = powerup.y - this.ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < powerup.radius + this.ball.size) {
                // Áp dụng hiệu ứng
                const player = this.ball.speedX > 0 ? 'left' : 'right';
                powerup.type.effect(player);

                // Xóa power-up
                this.powerups.splice(i, 1);
            }
        }
    }

    // Vẽ power-ups
    drawPowerups() {
        for (const powerup of this.powerups) {
            this.ctx.fillStyle = powerup.type.color;
            this.ctx.beginPath();
            this.ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    showPowerupMessage(powerupName, player) {
        const playerName = player === 'left' ? 'Trái' : 'Phải';
        const message = `${playerName}: ${powerupName}`;

        // Hiển thị thông báo
        this.powerupMessage = {
            text: message,
            time: Date.now(),
            duration: 2000 // 2 giây
        };
    }


    // Lấy paddle của đối phương
    getOpponentPaddle() {
        const side = document.getElementById('user-side').value;
        return side === 'left' ? this.rightPaddle : this.leftPaddle;
    }

    // Hàm trợ giúp để lấy cookie CSRF token
    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}