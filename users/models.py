from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    display_name = models.CharField(_('display name'), max_length=30, unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)
    last_activity = models.DateTimeField(auto_now=True)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def __str__(self):
        return self.display_name if self.display_name else self.username