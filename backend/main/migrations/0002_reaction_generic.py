# Migration to convert Reaction model from FK-to-Post to generic relation
from django.db import migrations, models
import django.db.models.deletion
# Use apps.get_model('contenttypes', 'ContentType') inside RunPython to be migration-safe


def forwards(apps, schema_editor):
    Reaction = apps.get_model('main', 'Reaction')
    Post = apps.get_model('main', 'Post')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    # Ensure a ContentType record exists for Post
    ct, _ = ContentType.objects.get_or_create(app_label='main', model='post')

    # For existing Reaction rows (if any) that used post_id, set content_type to Post and object_id
    for r in Reaction.objects.all():
        # If model already has content_type/object_id fields (we added them in code), skip
        if getattr(r, 'content_type_id', None):
            continue
        # Fallback: if there's a post_id field, migrate it
        pid = getattr(r, 'post_id', None)
        if pid:
            r.content_type_id = ct.id
            r.object_id = pid
            r.save()


def backwards(apps, schema_editor):
    # Irreversible
    return


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='reaction',
            name='content_type',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='+', to='contenttypes.contenttype'),
        ),
        migrations.AddField(
            model_name='reaction',
            name='object_id',
            field=models.BigIntegerField(null=True),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='reaction',
            name='content_type',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='contenttypes.contenttype'),
        ),
        migrations.AlterField(
            model_name='reaction',
            name='object_id',
            field=models.BigIntegerField(),
        ),
        # Make the old post FK nullable so new Reaction rows (using content_type/object_id)
        # can be created without supplying post_id. The actual removal of the column is
        # deferred to a later, careful migration.
        migrations.AlterField(
            model_name='reaction',
            name='post',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='main.post'),
        ),
        # Note: we intentionally do not remove the old 'post' FK in this migration to
        # avoid table-remake issues during the same migration step. A follow-up
        # migration will remove the 'post' field and finalize the unique constraint.
    ]
