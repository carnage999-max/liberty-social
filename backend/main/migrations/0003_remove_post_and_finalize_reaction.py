from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0002_reaction_generic"),
    ]

    # Remove the legacy 'post' FK column now that the generic relation exists and
    # the column was made nullable in the previous migration. Finalize the
    # unique constraint to use (content_type, object_id, user).
    # First update the unique_together so it no longer references 'post', then
    # remove the column. Ordering matters to avoid sqlite table-remake errors
    # where constraints reference fields that are being removed.
    operations = [
        migrations.AlterUniqueTogether(
            name='reaction',
            unique_together={('content_type', 'object_id', 'user')},
        ),
        migrations.RemoveField(
            model_name='reaction',
            name='post',
        ),
    ]

