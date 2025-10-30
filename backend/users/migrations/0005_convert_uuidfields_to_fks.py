# Generated migration to convert UUID identifier fields to proper ForeignKey relations
from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    User = apps.get_model('users', 'User')
    FriendRequest = apps.get_model('users', 'FriendRequest')
    Friends = apps.get_model('users', 'Friends')
    BlockedUsers = apps.get_model('users', 'BlockedUsers')

    # Backfill FriendRequest.from_user from existing user_requesting_id (UUID)
    for fr in FriendRequest.objects.all():
        uid = getattr(fr, 'user_requesting_id', None)
        if uid is not None:
            try:
                user = User.objects.get(id=uid)
                fr.from_user_id = user.id
                fr.save()
            except User.DoesNotExist:
                # leave null if user not found
                continue

    # Backfill Friends.friend from friend_user_id
    for f in Friends.objects.all():
        fid = getattr(f, 'friend_user_id', None)
        if fid is not None:
            try:
                user = User.objects.get(id=fid)
                f.friend_id = user.id
                f.save()
            except User.DoesNotExist:
                continue

    # Backfill BlockedUsers.blocked_user from blocked_user_id
    for b in BlockedUsers.objects.all():
        bid = getattr(b, 'blocked_user_id', None)
        if bid is not None:
            try:
                user = User.objects.get(id=bid)
                b.blocked_user_id = user.id
                b.save()
            except User.DoesNotExist:
                continue


def backwards(apps, schema_editor):
    # No-op backwards: irreversible data migration
    return


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_rename_user_friendrequest_to_user_alter_user_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='friendrequest',
            name='from_user',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='sent_friend_requests', to='users.user'),
        ),
        migrations.AddField(
            model_name='friends',
            name='friend',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='friends_of', to='users.user'),
        ),
        migrations.AddField(
            model_name='blockedusers',
            # add a temporary FK field to avoid colliding with existing 'blocked_user_id' column
            name='blocked_user_fk',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='blocked_by', to='users.user'),
        ),
        migrations.RunPython(forwards, backwards),
        # remove old raw UUID columns after backfill
        migrations.RemoveField(
            model_name='friendrequest',
            name='user_requesting_id',
        ),
        migrations.RemoveField(
            model_name='friends',
            name='friend_user_id',
        ),
        migrations.RemoveField(
            model_name='blockedusers',
            name='blocked_user_id',
        ),
        # rename temporary blocked_user_fk to blocked_user
        migrations.RenameField(
            model_name='blockedusers',
            old_name='blocked_user_fk',
            new_name='blocked_user',
        ),
        # ensure new FK fields are non-nullable (they were added null=True for backfill)
        migrations.AlterField(
            model_name='friendrequest',
            name='from_user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sent_friend_requests', to='users.user'),
        ),
        migrations.AlterField(
            model_name='friends',
            name='friend',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='friends_of', to='users.user'),
        ),
        migrations.AlterField(
            model_name='blockedusers',
            name='blocked_user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='blocked_by', to='users.user'),
        ),
        # friendrequest: allow multiple requests over time (no DB-level unique constraint)
        migrations.AlterUniqueTogether(
            name='friends',
            unique_together={('user', 'friend')},
        ),
        migrations.AlterUniqueTogether(
            name='blockedusers',
            unique_together={('user', 'blocked_user')},
        ),
    ]
