/**
 * File: static/js/pong-ai.js
 * Mô tả: Class quản lý AI cho trò chơi Pong
 */

class PongAI {
    constructor(options = {}) {
        // Các thiết lập độ khó
        this.difficulty = options.difficulty || 'medium';

        // Kích thước và vị trí paddle
        this.paddleHeight = options.paddleHeight || 100;
        this.paddleY = options.initialY || 250;
        this.fieldHeight = options.fieldHeight || 500;

        // Lưu trữ thông tin bóng để dự đoán
        this.ballHistory = [];
        this.maxHistory = 5;

        // Biến dự đoán
        this.targetY = this.paddleY;
        this.predictedY = null;

        // Thời gian
        this.lastUpdateTime = 0;

        // Thiết lập thông số dựa trên độ khó
        this.setupDifficulty();
    }

    // Thiết lập thông số dựa vào độ khó
    setupDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                this.reactionTime = 1000; // 1 giây
                this.errorMargin = 40;    // Lỗi dự đoán lớn
                this.predictionSkill = 0.6; // Khả năng dự đoán kém
                this.maxSpeed = 3;        // Di chuyển chậm
                break;

            case 'medium':
                this.reactionTime = 700;  // 0.7 giây
                this.errorMargin = 20;
                this.predictionSkill = 0.8;
                this.maxSpeed = 5;
                break;

            case 'hard':
                this.reactionTime = 500;  // 0.5 giây
                this.errorMargin = 10;    // Lỗi dự đoán nhỏ
                this.predictionSkill = 0.95; // Khả năng dự đoán gần như hoàn hảo
                this.maxSpeed = 7;        // Di chuyển nhanh
                break;

            default:
                this.reactionTime = 700;
                this.errorMargin = 20;
                this.predictionSkill = 0.8;
                this.maxSpeed = 5;
        }
    }

    // Cập nhật vị trí paddle của AI
    update(ballX, ballY, ballSpeedX, ballSpeedY, currentTime) {
        // Chỉ cập nhật khi đủ thời gian phản ứng
        if (currentTime - this.lastUpdateTime < this.reactionTime) {
            return this.paddleY;
        }

        // Cập nhật thời gian
        this.lastUpdateTime = currentTime;

        // Thêm thông tin bóng vào lịch sử để phân tích
        this.ballHistory.push({x: ballX, y: ballY, dx: ballSpeedX, dy: ballSpeedY});
        if (this.ballHistory.length > this.maxHistory) {
            this.ballHistory.shift();
        }

        // Dự đoán vị trí bóng khi chạm đến paddle của AI
        if (ballSpeedX > 0) { // Bóng đang di chuyển về phía AI (phải)
            this.predictBallPosition(ballX, ballY, ballSpeedX, ballSpeedY);
        }

        // Di chuyển paddle dựa vào dự đoán
        if (this.predictedY !== null) {
            // Thêm lỗi dự đoán để tăng tính người thật
            const error = (Math.random() * 2 - 1) * this.errorMargin;
            const targetY = this.predictedY + error;

            // Giới hạn trong khoảng hợp lệ
            this.targetY = Math.max(this.paddleHeight / 2,
                          Math.min(this.fieldHeight - this.paddleHeight / 2, targetY));
        }

        // Di chuyển paddle với tốc độ giới hạn
        const paddleCenter = this.paddleY + this.paddleHeight / 2;
        const distance = this.targetY - paddleCenter;

        if (Math.abs(distance) > this.maxSpeed) {
            // Di chuyển với tốc độ tối đa
            this.paddleY += Math.sign(distance) * this.maxSpeed;
        } else {
            // Di chuyển trực tiếp đến vị trí mục tiêu
            this.paddleY += distance;
        }

        // Giới hạn paddle trong khoảng hợp lệ
        this.paddleY = Math.max(0, Math.min(this.fieldHeight - this.paddleHeight, this.paddleY));

        return this.paddleY;
    }

    // Dự đoán vị trí bóng khi chạm đến paddle phải
    predictBallPosition(ballX, ballY, ballSpeedX, ballSpeedY) {
        if (ballSpeedX <= 0) return; // Bóng đang di chuyển về phía khác

        // Tính toán thời gian để bóng đến paddle phải
        const rightSideX = 800 - 20 - this.paddleHeight/2; // Vị trí paddle phải
        const timeToReach = (rightSideX - ballX) / ballSpeedX;

        // Tính toán vị trí y của bóng tại thời điểm đó
        let predictedY = ballY + (ballSpeedY * timeToReach);

        // Xử lý các lần nảy trên tường
        const bounces = Math.floor(Math.abs(predictedY) / this.fieldHeight) +
                       Math.floor(Math.abs(predictedY - this.fieldHeight) / this.fieldHeight);

        if (bounces % 2 === 1) {
            predictedY = this.fieldHeight - Math.abs(predictedY % this.fieldHeight);
        } else {
            predictedY = Math.abs(predictedY % this.fieldHeight);
        }

        // Áp dụng độ chính xác dự đoán dựa vào độ khó
        if (this.predictionSkill < 1.0) {
            const skillError = (1.0 - this.predictionSkill) * this.fieldHeight * (Math.random() - 0.5);
            predictedY += skillError;
        }

        // Lưu giá trị dự đoán
        this.predictedY = predictedY;
    }

    // Đặt lại AI
    reset(initialY) {
        this.paddleY = initialY || this.fieldHeight / 2 - this.paddleHeight / 2;
        this.targetY = this.paddleY;
        this.predictedY = null;
        this.ballHistory = [];
        this.lastUpdateTime = 0;
    }
}