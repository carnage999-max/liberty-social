# Generated migration to add edited_at field to Message model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0010_rename_main_mess_convers_b9592d_idx_main_messag_convers_370a90_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

