from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    display_name = models.CharField(_('display name'), max_length=30, unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, default='avatars/default.png')
    is_online = models.BooleanField(default=False)
    last_activity = models.DateTimeField(auto_now=True)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    friends = models.ManyToManyField('self', through='Friendship', symmetrical=False)

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def __str__(self):
        return self.display_name if self.display_name else self.username

    @property
    def win_rate(self):
        total_games = self.wins + self.losses
        if total_games > 0:
            return round((self.wins / total_games) * 100, 1)
        return 0


class Friendship(models.Model):
    from_user = models.ForeignKey(User, related_name='friendship_requests_sent', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='friendship_requests_received', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    STATUS_CHOICES = [
        ('pending', _('Pending')),
        ('accepted', _('Accepted')),
        ('rejected', _('Rejected')),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    class Meta:
        unique_together = ('from_user', 'to_user')
        verbose_name = _('Friendship')
        verbose_name_plural = _('Friendships')

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"


class Match(models.Model):
    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='matches_as_player2', on_delete=models.CASCADE)
    player1_score = models.IntegerField(default=0)
    player2_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_tournament = models.BooleanField(default=False)
    tournament_name = models.CharField(max_length=100, blank=True, null=True)
    is_finished = models.BooleanField(default=False)

    class Meta:
        verbose_name = _('Match')
        verbose_name_plural = _('Matches')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.player1} vs {self.player2} ({self.created_at.strftime('%Y-%m-%d')})"

    @property
    def winner(self):
        if not self.is_finished:
            return None
        if self.player1_score > self.player2_score:
            return self.player1
        elif self.player2_score > self.player1_score:
            return self.player2
        return None