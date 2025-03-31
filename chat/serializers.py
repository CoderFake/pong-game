from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, DirectMessage, BlockedUser
from users.serializers import UserSerializer

User = get_user_model()


class ChatRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'room', 'sender', 'content', 'created_at', 'is_game_invite']
        read_only_fields = ['id', 'sender', 'created_at']

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class DirectMessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)
    recipient_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        write_only=True,
        source='recipient'
    )

    class Meta:
        model = DirectMessage
        fields = ['id', 'sender', 'recipient', 'recipient_id', 'content',
                  'created_at', 'read', 'is_game_invite', 'game_id']
        read_only_fields = ['id', 'sender', 'created_at', 'read']

    def validate_recipient_id(self, recipient):
        user = self.context['request'].user

        if recipient == user:
            raise serializers.ValidationError("You cannot send a message to yourself")

        if BlockedUser.objects.filter(user=recipient, blocked_user=user).exists():
            raise serializers.ValidationError("This user has blocked you")

        if BlockedUser.objects.filter(user=user, blocked_user=recipient).exists():
            raise serializers.ValidationError("You have blocked this user")

        return recipient


class BlockedUserSerializer(serializers.ModelSerializer):
    blocked_user = UserSerializer(read_only=True)
    blocked_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        write_only=True,
        source='blocked_user'
    )

    class Meta:
        model = BlockedUser
        fields = ['id', 'blocked_user', 'blocked_user_id', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_blocked_user_id(self, blocked_user):
        user = self.context['request'].user

        if blocked_user == user:
            raise serializers.ValidationError("You cannot block yourself")

        if BlockedUser.objects.filter(user=user, blocked_user=blocked_user).exists():
            raise serializers.ValidationError("You have already blocked this user")

        return blocked_user