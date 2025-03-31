# Tạo mới file game/ai.py
class PongAI:
    """
    Class triển khai AI cho game Pong ở phía server
    """

    def __init__(self, difficulty='medium', field_height=500, field_width=800):
        self.difficulty = difficulty
        self.field_height = field_height
        self.field_width = field_width
        self.paddle_height = 100
        self.paddle_y = field_height / 2 - self.paddle_height / 2

        # Các tham số phụ thuộc vào độ khó
        self.setup_difficulty()

        # Lưu lịch sử để dự đoán
        self.ball_history = []
        self.max_history = 5
        self.last_update_time = 0

    def setup_difficulty(self):
        """Thiết lập tham số dựa trên độ khó"""
        if self.difficulty == 'easy':
            self.reaction_time = 1.0  # giây
            self.error_margin = 40  # pixel
            self.prediction_skill = 0.6  # 0-1, càng cao càng chính xác
            self.max_speed = 3
        elif self.difficulty == 'medium':
            self.reaction_time = 0.7
            self.error_margin = 20
            self.prediction_skill = 0.8
            self.max_speed = 5
        else:  # hard
            self.reaction_time = 0.5
            self.error_margin = 10
            self.prediction_skill = 0.95
            self.max_speed = 7

    def update(self, ball_x, ball_y, ball_dx, ball_dy, current_time):
        """
        Cập nhật vị trí paddle dựa trên vị trí và vận tốc bóng

        Args:
            ball_x, ball_y: Vị trí hiện tại của bóng
            ball_dx, ball_dy: Vận tốc của bóng
            current_time: Thời gian hiện tại

        Returns:
            float: Vị trí y mới của paddle
        """
        # Chỉ cập nhật sau khoảng thời gian reaction_time
        if current_time - self.last_update_time < self.reaction_time:
            return self.paddle_y

        self.last_update_time = current_time

        # Lưu thông tin bóng vào lịch sử
        self.ball_history.append((ball_x, ball_y, ball_dx, ball_dy))
        if len(self.ball_history) > self.max_history:
            self.ball_history.pop(0)

        # Chỉ dự đoán khi bóng đang di chuyển về phía AI
        if ball_dx > 0:
            # Dự đoán vị trí y khi bóng đến paddle
            predicted_y = self._predict_y_position(ball_x, ball_y, ball_dx, ball_dy)

            # Thêm lỗi ngẫu nhiên dựa trên độ khó
            import random
            error = random.uniform(-self.error_margin, self.error_margin)
            target_y = predicted_y + error

            # Giới hạn trong phạm vi hợp lệ
            target_y = max(self.paddle_height / 2,
                           min(self.field_height - self.paddle_height / 2, target_y))

            # Di chuyển paddle về vị trí mục tiêu
            paddle_center = self.paddle_y + self.paddle_height / 2
            if abs(target_y - paddle_center) > self.max_speed:
                if target_y > paddle_center:
                    self.paddle_y += self.max_speed
                else:
                    self.paddle_y -= self.max_speed
            else:
                self.paddle_y = target_y - self.paddle_height / 2

        return self.paddle_y

    def _predict_y_position(self, ball_x, ball_y, ball_dx, ball_dy):
        """
        Dự đoán vị trí y của bóng khi đến vị trí paddle
        """
        # Tính thời gian để bóng đến paddle
        paddle_x = self.field_width - 20  # vị trí paddle
        time_to_reach = (paddle_x - ball_x) / ball_dx

        # Dự đoán vị trí y
        predicted_y = ball_y + (ball_dy * time_to_reach)

        # Xử lý các lần nảy tường
        bounces = 0
        while predicted_y < 0 or predicted_y > self.field_height:
            if predicted_y < 0:
                predicted_y = -predicted_y
            elif predicted_y > self.field_height:
                predicted_y = 2 * self.field_height - predicted_y
            bounces += 1

            # Giới hạn số lần nảy để tránh loop vô hạn
            if bounces > 10:
                predicted_y = self.field_height / 2
                break

        return predicted_y

    def reset(self):
        """Reset AI về trạng thái ban đầu"""
        self.paddle_y = self.field_height / 2 - self.paddle_height / 2
        self.ball_history = []
        self.last_update_time = 0