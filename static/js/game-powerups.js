/**
 * File: static/js/game-powerups.js
 * Mô tả: Quản lý power-ups và hiệu ứng đặc biệt cho game Pong
 */

class PowerupManager {
    constructor(gameInstance) {
        // Lưu trữ instance của game
        this.game = gameInstance;

        // Danh sách các power-up đang hoạt động
        this.activePowerups = [];

        // Danh sách các power-up đang có trên sân
        this.powerupsOnField = [];

        // Định nghĩa các loại power-up
        this.powerupTypes = [
            {
                id: 'bigger_paddle',
                name: 'Paddle lớn hơn',
                color: '#3CB371', // Xanh lá
                duration: 5000,   // 5 giây
                radius: 10,
                effect: (player) => this.applyBiggerPaddle(player),
                revert: (player) => this.revertBiggerPaddle(player)
            },
            {
                id: 'smaller_opponent',
                name: 'Thu nhỏ đối thủ',
                color: '#FF6347', // Đỏ
                duration: 5000,
                radius: 10,
                effect: (player) => this.applySmallerOpponent(player),
                revert: (player) => this.revertSmallerOpponent(player)
            },
            {
                id: 'faster_paddle',
                name: 'Paddle nhanh hơn',
                color: '#4169E1', // Xanh dương
                duration: 5000,
                radius: 10,
                effect: (player) => this.applyFasterPaddle(player),
                revert: (player) => this.revertFasterPaddle(player)
            },
            {
                id: 'ball_speed',
                name: 'Tốc độ bóng',
                color: '#FFD700', // Vàng
                duration: 5000,
                radius: 10,
                effect: (player) => this.applyBallSpeed(player),
                revert: (player) => this.revertBallSpeed(player)
            },
            {
                id: 'curved_ball',
                name: 'Bóng cong',
                color: '#9932CC', // Tím
                duration: 7000,
                radius: 10,
                effect: (player) => this.applyCurvedBall(player),
                revert: (player) => this.revertCurvedBall(player)
            }
        ];

        // Thiết lập thời gian tạo power-up
        this.lastPowerupTime = 0;
        this.powerupInterval = 10000; // 10 giây
    }

    // Cập nhật logic power-up
    update(deltaTime) {
        const currentTime = Date.now();

        // Tạo power-up mới nếu đã đến lúc
        if (currentTime - this.lastPowerupTime > this.powerupInterval &&
            this.powerupsOnField.length < 3 &&
            this.game.gameState.running &&
            !this.game.gameState.paused) {

            this.createPowerup();
            this.lastPowerupTime = currentTime;
        }

        // Cập nhật và kiểm tra va chạm với power-up
        this.updatePowerupsOnField();

        // Kiểm tra power-up hết hạn
        this.checkExpiredPowerups(currentTime);
    }

    // Tạo power-up mới
    createPowerup() {
        // Chọn ngẫu nhiên một loại power-up
        const randomType = this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)];

        // Tạo vị trí ngẫu nhiên
        const x = Math.random() * (this.game.options.width - 150) + 75;
        const y = Math.random() * (this.game.options.height - 150) + 75;

        // Tạo một power-up mới
        const powerup = {
            type: randomType,
            x: x,
            y: y,
            radius: randomType.radius,
            active: true,
            createdAt: Date.now()
        };

        this.powerupsOnField.push(powerup);
    }

    // Cập nhật power-up trên sân và kiểm tra va chạm
    updatePowerupsOnField() {
        for (let i = this.powerupsOnField.length - 1; i >= 0; i--) {
            const powerup = this.powerupsOnField[i];

            // Kiểm tra va chạm với bóng
            const distance = Math.sqrt(
                Math.pow(powerup.x - this.game.ball.x, 2) +
                Math.pow(powerup.y - this.game.ball.y, 2)
            );

            if (distance < powerup.radius + this.game.ball.size) {
                // Xác định người chơi sẽ nhận power-up
                const player = this.game.ball.speedX > 0 ? 'left' : 'right';

                // Áp dụng hiệu ứng power-up
                this.applyPowerup(powerup, player);

                // Xóa power-up khỏi sân
                this.powerupsOnField.splice(i, 1);

                // Gửi thông báo lên server nếu có Websocket
                if (this.game.ws) {
                    this.game.ws.send(JSON.stringify({
                        type: 'powerup_pickup',
                        powerup_type: powerup.type.id,
                        player_side: player,
                        duration: powerup.type.duration
                    }));
                }
            }
        }
    }

    // Kiểm tra power-up hết hạn
    checkExpiredPowerups(currentTime) {
        for (let i = this.activePowerups.length - 1; i >= 0; i--) {
            const activePowerup = this.activePowerups[i];

            if (currentTime - activePowerup.startTime >= activePowerup.type.duration) {
                // Hoàn tác hiệu ứng
                activePowerup.type.revert(activePowerup.player);

                // Xóa khỏi danh sách active
                this.activePowerups.splice(i, 1);
            }
        }
    }

    // Áp dụng power-up
    applyPowerup(powerup, player) {
        // Thêm vào danh sách active
        this.activePowerups.push({
            type: powerup.type,
            player: player,
            startTime: Date.now()
        });

        // Kích hoạt hiệu ứng
        powerup.type.effect(player);

        // Hiển thị thông báo
        if (this.game.showPowerupMessage) {
            this.game.showPowerupMessage(powerup.type.name, player);
        }
    }

    // Vẽ power-up
    drawPowerups(ctx) {
        // Vẽ các power-up trên sân
        this.powerupsOnField.forEach(powerup => {
            ctx.fillStyle = powerup.type.color;
            ctx.beginPath();
            ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
            ctx.fill();

            // Thêm hiệu ứng nhấp nháy
            const currentTime = Date.now();
            if (Math.floor(currentTime / 500) % 2 === 0) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    // Hiệu ứng paddle lớn hơn
    applyBiggerPaddle(player) {
        const paddle = player === 'left' ? this.game.leftPaddle : this.game.rightPaddle;
        paddle.originalHeight = paddle.height;
        paddle.height *= 1.5;
    }

    revertBiggerPaddle(player) {
        const paddle = player === 'left' ? this.game.leftPaddle : this.game.rightPaddle;
        if (paddle.originalHeight) {
            paddle.height = paddle.originalHeight;
            delete paddle.originalHeight;
        }
    }

    // Hiệu ứng thu nhỏ đối thủ
    applySmallerOpponent(player) {
        const paddle = player === 'left' ? this.game.rightPaddle : this.game.leftPaddle;
        paddle.originalHeight = paddle.height;
        paddle.height *= 0.5;
    }

    revertSmallerOpponent(player) {
        const paddle = player === 'left' ? this.game.rightPaddle : this.game.leftPaddle;
        if (paddle.originalHeight) {
            paddle.height = paddle.originalHeight;
            delete paddle.originalHeight;
        }
    }

    // Hiệu ứng paddle nhanh hơn
    applyFasterPaddle(player) {
        const paddle = player === 'left' ? this.game.leftPaddle : this.game.rightPaddle;
        paddle.originalSpeed = paddle.speed;
        paddle.speed *= 1.5;
    }

    revertFasterPaddle(player) {
        const paddle = player === 'left' ? this.game.leftPaddle : this.game.rightPaddle;
        if (paddle.originalSpeed) {
            paddle.speed = paddle.originalSpeed;
            delete paddle.originalSpeed;
        }
    }

    // Hiệu ứng tốc độ bóng
    applyBallSpeed(player) {
        // Tăng tốc độ bóng theo hướng của người chơi
        this.game.ball.originalSpeedX = this.game.ball.speedX;
        this.game.ball.originalSpeedY = this.game.ball.speedY;

        if ((player === 'left' && this.game.ball.speedX < 0) ||
            (player === 'right' && this.game.ball.speedX > 0)) {
            // Tăng tốc theo hướng của người chơi
            this.game.ball.speedX *= 1.3;
            this.game.ball.speedY *= 1.3;
        }
    }

    revertBallSpeed(player) {
        if (this.game.ball.originalSpeedX) {
            this.game.ball.speedX = this.game.ball.originalSpeedX;
            this.game.ball.speedY = this.game.ball.originalSpeedY;
            delete this.game.ball.originalSpeedX;
            delete this.game.ball.originalSpeedY;
        }
    }

    // Hiệu ứng bóng cong
    applyCurvedBall(player) {
        this.game.ball.isCurved = true;
        this.game.ball.curveDirection = Math.random() > 0.5 ? 1 : -1;
        this.game.ball.curveOwner = player;
    }

    revertCurvedBall(player) {
        this.game.ball.isCurved = false;
        delete this.game.ball.curveDirection;
        delete this.game.ball.curveOwner;
    }

    // Reset tất cả power-up khi bắt đầu game mới
    reset() {
        // Hoàn tác tất cả hiệu ứng đang hoạt động
        this.activePowerups.forEach(activePowerup => {
            activePowerup.type.revert(activePowerup.player);
        });

        // Xóa tất cả power-up
        this.activePowerups = [];
        this.powerupsOnField = [];
        this.lastPowerupTime = 0;
    }
}