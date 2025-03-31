/**
 * File: static/js/chat-manager.js
 * Mô tả: Quản lý hệ thống chat
 */

let chatSocket = null;
let currentChatRecipient = null;

function initChatManager(user) {
    // Khởi tạo WebSocket cho chat
    connectChatWebSocket();

    // Tải danh sách bạn bè cho chat
    loadChatFriendsList();

    // Thiết lập sự kiện
    setupChatEvents();
}

// Kết nối WebSocket cho chat
function connectChatWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/direct-chat/`;

    chatSocket = new WebSocket(wsUrl);

    chatSocket.onopen = function(e) {
        console.log('Kết nối WebSocket chat thành công');
    };

    chatSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        handleChatWebSocketMessage(data);
    };

    chatSocket.onclose = function(e) {
        console.log('Kết nối WebSocket chat đã đóng');
        // Thử kết nối lại sau 5 giây
        setTimeout(function() {
            connectChatWebSocket();
        }, 5000);
    };

    chatSocket.onerror = function(e) {
        console.error('Lỗi WebSocket chat:', e);
    };
}

// Xử lý tin nhắn WebSocket
function handleChatWebSocketMessage(data) {
    switch (data.type) {
        case 'direct_message':
            // Nhận tin nhắn mới
            const message = data.message;

            // Thêm tin nhắn vào khung chat nếu đang chat với người gửi
            if (currentChatRecipient && currentChatRecipient.id === message.sender.id) {
                addMessageToChat(message);

                // Đánh dấu tin nhắn là đã đọc
                markMessageAsRead(message.id);
            } else {
                // Hiển thị thông báo có tin nhắn mới
                showNewMessageNotification(message);
            }
            break;

        case 'unread_messages':
            // Tải tin nhắn chưa đọc khi kết nối
            console.log('Có tin nhắn chưa đọc:', data.messages.length);

            // Hiển thị thông báo cho mỗi tin nhắn chưa đọc
            if (data.messages.length > 0) {
                data.messages.forEach(message => {
                    showNewMessageNotification(message);
                });
            }
            break;

        case 'user_blocked':
            // Thông báo chặn người dùng thành công
            console.log('Đã chặn người dùng ID:', data.user_id);
            break;

        case 'user_unblocked':
            // Thông báo bỏ chặn người dùng thành công
            console.log('Đã bỏ chặn người dùng ID:', data.user_id);
            break;
    }
}

// Hiển thị thông báo tin nhắn mới
function showNewMessageNotification(message) {
    // Cập nhật giao diện để thông báo có tin nhắn mới
    const friendListItem = document.querySelector(`.chat-friend-item[data-id="${message.sender.id}"]`);

    if (friendListItem) {
        friendListItem.classList.add('bg-light');
        const badge = friendListItem.querySelector('.unread-badge');

        if (badge) {
            const count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
            badge.classList.remove('d-none');
        } else {
            const newBadge = document.createElement('span');
            newBadge.className = 'badge bg-danger ms-2 unread-badge';
            newBadge.textContent = '1';
            friendListItem.querySelector('.friend-name').appendChild(newBadge);
        }
    }
}

// Tải danh sách bạn bè cho chat
function loadChatFriendsList() {
    $.ajax({
        url: '/api/users/friends/',
        method: 'GET',
        success: function(friends) {
            const friendsList = $('#chat-friends-list');
            friendsList.empty();

            if (friends.length > 0) {
                friends.forEach(friend => {
                    const item = $(`
                        <div class="chat-friend-item player-list-item d-flex align-items-center" data-id="${friend.id}" data-username="${friend.username}">
                            <div class="me-2">
                                <img src="${friend.avatar || '/media/avatars/default.png'}" class="user-avatar" alt="${friend.display_name}">
                            </div>
                            <div class="flex-grow-1">
                                <div class="friend-name">
                                    <span class="online-status ${friend.is_online ? 'status-online' : 'status-offline'}"></span>
                                    ${friend.display_name || friend.username}
                                </div>
                            </div>
                        </div>
                    `);

                    friendsList.append(item);
                });

                // Sự kiện cho từng người bạn
                $('.chat-friend-item').on('click', function() {
                    const friendId = $(this).data('id');
                    const username = $(this).data('username');

                    // Tải thông tin người dùng để chat
                    $.ajax({
                        url: `/api/users/profile/${username}/`,
                        method: 'GET',
                        success: function(user) {
                            openChatWindow(user);
                        },
                        error: function(error) {
                            console.error('Lỗi khi tải thông tin người dùng:', error);
                        }
                    });
                });
            } else {
                friendsList.html('<p class="text-center p-3">Bạn chưa có bạn bè nào. Hãy thêm bạn bè để trò chuyện.</p>');
            }
        },
        error: function(error) {
            console.error('Lỗi khi tải danh sách bạn bè:', error);
            $('#chat-friends-list').html('<p class="text-center p-3">Đã xảy ra lỗi khi tải danh sách bạn bè.</p>');
        }
    });
}

// Mở cửa sổ chat với người dùng
function openChatWindow(user) {
    currentChatRecipient = user;

    // Cập nhật giao diện
    $('#chat-recipient-name').text(user.display_name || user.username);
    $('#chat-message-input').prop('disabled', false);
    $('#send-message-btn').prop('disabled', false);
    $('#chat-actions').removeClass('d-none');

    // Xóa tin nhắn cũ
    $('#chat-messages').empty();

    // Tải tin nhắn cũ
    loadChatHistory(user.id);

    // Xóa hiệu ứng tin nhắn mới
    const friendListItem = document.querySelector(`.chat-friend-item[data-id="${user.id}"]`);
    if (friendListItem) {
        friendListItem.classList.remove('bg-light');
        const badge = friendListItem.querySelector('.unread-badge');
        if (badge) {
            badge.classList.add('d-none');
        }
    }
}

// Tải lịch sử chat
function loadChatHistory(recipientId) {
    $.ajax({
        url: '/api/chat/direct-messages/',
        method: 'GET',
        data: {
            recipient_id: recipientId
        },
        success: function(response) {
            const messages = response.results || response;

            // Sắp xếp tin nhắn theo thời gian
            messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            // Hiển thị tin nhắn
            messages.forEach(message => {
                addMessageToChat(message, true);

                // Đánh dấu tin nhắn đã đọc nếu là người nhận
                if (message.recipient.id === userId && !message.read) {
                    markMessageAsRead(message.id);
                }
            });

            // Cuộn xuống tin nhắn mới nhất
            scrollToLatestMessage();
        },
        error: function(error) {
            console.error('Lỗi khi tải lịch sử chat:', error);
            $('#chat-messages').html('<p class="text-center text-danger">Không thể tải tin nhắn</p>');
        }
    });
}

// Thêm tin nhắn vào khung chat
function addMessageToChat(message, isHistory = false) {
    const isOwnMessage = message.sender.id === userId;
    const messageDate = new Date(message.created_at);
    const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageElement = $(`
        <div class="message ${isOwnMessage ? 'message-own' : 'message-other'} mb-2">
            <div class="mb-1">
                <strong>${isOwnMessage ? 'Bạn' : message.sender.display_name || message.sender.username}</strong>
                <small class="text-muted ms-2">${timeString}</small>
            </div>
            <div>${message.content}</div>
            ${message.is_game_invite ? `
                <div class="mt-2">
                    <a href="#game/${message.game_id}" class="btn btn-sm btn-outline-primary">Tham gia game</a>
                </div>
            ` : ''}
        </div>
    `);

    $('#chat-messages').append(messageElement);

    // Cuộn xuống tin nhắn mới nhất nếu không phải đang tải lịch sử
    if (!isHistory) {
        scrollToLatestMessage();
    }
}

// Cuộn xuống tin nhắn mới nhất
function scrollToLatestMessage() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Đánh dấu tin nhắn đã đọc
function markMessageAsRead(messageId) {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            type: 'mark_read',
            message_id: messageId
        }));
    }
}

// Thiết lập sự kiện cho chat
function setupChatEvents() {
    // Gửi tin nhắn
    $('#send-message-btn').on('click', function() {
        sendMessage();
    });

    // Gửi tin nhắn khi nhấn Enter
    $('#chat-message-input').on('keypress', function(e) {
        if (e.which === 13) {
            sendMessage();
            return false;
        }
    });

    // Nút mời chơi game
    $('#invite-game-btn').on('click', function() {
        if (currentChatRecipient) {
            $('#invite-game-modal').modal('show');
        }
    });

    // Gửi lời mời chơi game
    $('#send-invite-btn').on('click', function() {
        if (!currentChatRecipient) return;

        const maxScore = $('#invite-max-score').val();
        const enablePowerups = $('#invite-enable-powerups').prop('checked');

        // Tạo game mới
        $.ajax({
            url: '/api/game/games/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            data: JSON.stringify({
                max_score: maxScore,
                enable_powerups: enablePowerups
            }),
            success: function(game) {
                // Gửi lời mời qua chat
                if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
                    chatSocket.send(JSON.stringify({
                        type: 'direct_message',
                        recipient_id: currentChatRecipient.id,
                        content: `Tôi mời bạn chơi một trận Pong. Điểm tối đa: ${maxScore}, Power-ups: ${enablePowerups ? 'Có' : 'Không'}`,
                        is_game_invite: true,
                        game_id: game.id
                    }));
                }

                $('#invite-game-modal').modal('hide');

                // Hiển thị màn hình chờ
                showWaitingScreen(game);
            },
            error: function(error) {
                console.error('Lỗi khi tạo game:', error);
                alert('Đã xảy ra lỗi khi tạo game. Vui lòng thử lại.');
            }
        });
    });

    // Nút chặn người dùng
    $('#block-user-btn').on('click', function() {
        if (currentChatRecipient) {
            if (confirm(`Bạn có chắc chắn muốn chặn ${currentChatRecipient.display_name || currentChatRecipient.username}?`)) {
                blockUser(currentChatRecipient.id);
            }
        }
    });
}

// Gửi tin nhắn
function sendMessage() {
    if (!currentChatRecipient) return;

    const content = $('#chat-message-input').val().trim();
    if (!content) return;

    // Gửi tin nhắn qua WebSocket
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            type: 'direct_message',
            recipient_id: currentChatRecipient.id,
            content: content
        }));

        // Xóa nội dung input
        $('#chat-message-input').val('');
    } else {
        alert('Kết nối chat không khả dụng. Vui lòng thử lại sau.');
    }
}

// Chặn người dùng
function blockUser(userId) {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            type: 'block_user',
            user_id: userId
        }));

        // Đóng cửa sổ chat và tải lại danh sách bạn bè
        currentChatRecipient = null;
        $('#chat-recipient-name').text('Chọn một người để bắt đầu trò chuyện');
        $('#chat-message-input').prop('disabled', true);
        $('#send-message-btn').prop('disabled', true);
        $('#chat-actions').addClass('d-none');
        $('#chat-messages').html('<p class="text-center text-muted">Chọn một người để bắt đầu trò chuyện</p>');

        // Tải lại danh sách bạn bè
        loadChatFriendsList();
    }
}