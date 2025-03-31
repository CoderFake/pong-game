from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User


class Game(models.Model):
    STATUS_CHOICES = [
        ('waiting', _('Waiting for players')),
        ('playing', _('In progress')),
        ('finished', _('Finished')),
    ]

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_tournament = models.BooleanField(default=False)
    tournament_name = models.CharField(max_length=100, blank=True, null=True)
    max_score = models.IntegerField(default=5)

    ai_enabled = models.BooleanField(default=False)
    ai_difficulty = models.CharField(
        max_length=10,
        choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')],
        default='medium'
    )

    # Thêm các trường cho Power-ups
    enable_powerups = models.BooleanField(default=False)
    powerup_frequency = models.IntegerField(default=10)  # seconds

    # Thêm các trường cho multiplayer
    max_players = models.IntegerField(default=2)
    game_type = models.CharField(
        max_length=20,
        choices=[
            ('classic', 'Classic 1v1'),
            ('tournament', 'Tournament'),
            ('multiplayer', 'Multiplayer')
        ],
        default='classic'
    )

    # Game customization options
    ball_speed = models.FloatField(default=1.0)  # Multiplier
    paddle_size = models.CharField(max_length=10, default='medium',
                                   choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')])

    class Meta:
        verbose_name = _('Game')
        verbose_name_plural = _('Games')
        ordering = ['-created_at']

    def __str__(self):
        return f"Game {self.id} - {self.get_status_display()}"


class GamePlayer(models.Model):
    game = models.ForeignKey(Game, related_name='players', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='game_players', on_delete=models.CASCADE)
    side = models.CharField(max_length=10, choices=[('left', 'Left'), ('right', 'Right')])
    score = models.IntegerField(default=0)
    ready = models.BooleanField(default=False)
    connected = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    is_ai = models.BooleanField(default=False)

    class Meta:
        verbose_name = _('Game Player')
        verbose_name_plural = _('Game Players')
        unique_together = ('game', 'user')

    def __str__(self):
        return f"{self.user.display_name} - {self.side} - Game {self.game.id}"


class Tournament(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, related_name='created_tournaments', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    max_players = models.IntegerField(default=8)
    current_round = models.IntegerField(default=0)
    STATUS_CHOICES = [
        ('registration', _('Registration Open')),
        ('in_progress', _('In Progress')),
        ('completed', _('Completed')),
    ]
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='registration')

    # Tournament settings that will be applied to all games
    max_score = models.IntegerField(default=5)
    enable_powerups = models.BooleanField(default=False)

    class Meta:
        verbose_name = _('Tournament')
        verbose_name_plural = _('Tournaments')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class TournamentPlayer(models.Model):
    tournament = models.ForeignKey(Tournament, related_name='players', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='tournament_players', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    eliminated = models.BooleanField(default=False)
    current_position = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = _('Tournament Player')
        verbose_name_plural = _('Tournament Players')
        unique_together = ('tournament', 'user')
        ordering = ['current_position', 'joined_at']

    def __str__(self):
        return f"{self.user.display_name} - {self.tournament.name}"


class TournamentMatch(models.Model):
    tournament = models.ForeignKey(Tournament, related_name='matches', on_delete=models.CASCADE)
    game = models.OneToOneField(Game, on_delete=models.CASCADE, null=True, blank=True)
    round_number = models.IntegerField()
    match_number = models.IntegerField()
    player1 = models.ForeignKey(TournamentPlayer, related_name='matches_as_player1',
                                on_delete=models.CASCADE, null=True, blank=True)
    player2 = models.ForeignKey(TournamentPlayer, related_name='matches_as_player2',
                                on_delete=models.CASCADE, null=True, blank=True)
    winner = models.ForeignKey(TournamentPlayer, related_name='matches_won',
                               on_delete=models.CASCADE, null=True, blank=True)
    next_match = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='previous_matches')

    class Meta:
        verbose_name = _('Tournament Match')
        verbose_name_plural = _('Tournament Matches')
        ordering = ['round_number', 'match_number']
        unique_together = ('tournament', 'round_number', 'match_number')

    def __str__(self):
        p1 = self.player1.user.display_name if self.player1 else "TBD"
        p2 = self.player2.user.display_name if self.player2 else "TBD"
        return f"{p1} vs {p2} - Round {self.round_number} Match {self.match_number}"



