from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Friendship, Match

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    win_rate = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ('id', 'username', 'display_name', 'email', 'avatar', 'is_online', 'wins', 'losses', 'win_rate')
        read_only_fields = ('wins', 'losses', 'win_rate')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'password2', 'email', 'display_name')
        extra_kwargs = {
            'email': {'required': True},
            'display_name': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            display_name=validated_data['display_name']
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('display_name', 'avatar')


class FriendshipSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)

    class Meta:
        model = Friendship
        fields = ('id', 'from_user', 'to_user', 'status', 'created_at')
        read_only_fields = ('id', 'from_user', 'to_user', 'created_at')


class FriendRequestCreateSerializer(serializers.ModelSerializer):
    to_user_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Friendship
        fields = ('to_user_id',)

    def create(self, validated_data):
        from_user = self.context['request'].user
        to_user_id = validated_data.pop('to_user_id')

        try:
            to_user = User.objects.get(id=to_user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"to_user_id": "User does not exist"})

        if from_user.id == to_user.id:
            raise serializers.ValidationError({"to_user_id": "You cannot add yourself as a friend"})

        if Friendship.objects.filter(from_user=from_user, to_user=to_user).exists():
            raise serializers.ValidationError({"to_user_id": "Friend request already sent"})

        if Friendship.objects.filter(from_user=to_user, to_user=from_user, status='accepted').exists():
            raise serializers.ValidationError({"to_user_id": "Already friends"})

        return Friendship.objects.create(from_user=from_user, to_user=to_user)


class MatchSerializer(serializers.ModelSerializer):
    player1 = UserSerializer(read_only=True)
    player2 = UserSerializer(read_only=True)
    winner = UserSerializer(read_only=True)

    class Meta:
        model = Match
        fields = ('id', 'player1', 'player2', 'player1_score', 'player2_score',
                  'created_at', 'is_tournament', 'tournament_name', 'is_finished', 'winner')
        read_only_fields = ('id', 'created_at', 'winner')