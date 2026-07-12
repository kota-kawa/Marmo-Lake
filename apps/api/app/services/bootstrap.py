from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AIActionDefinition,
    Announcement,
    Checklist,
    ChecklistItem,
    Note,
    Setting,
    Workspace,
)

ACTION_DEFINITIONS = [
    {
        "key": "open_app",
        "name": "画面を開く",
        "description": "登録済みの業務画面または標準アプリを開きます。",
        "module_key": "workspace",
        "required_role": "staff",
        "risk_level": "low",
        "requires_confirmation": False,
        "is_undoable": False,
    },
    {
        "key": "search_workspace_basic",
        "name": "探す",
        "description": "業務画面、メモ、お知らせ、チェックリスト、書類を横断して探します。",
        "module_key": "workspace",
        "required_role": "staff",
        "risk_level": "low",
        "requires_confirmation": False,
        "is_undoable": False,
    },
    {
        "key": "draft_note",
        "name": "下書きを作る",
        "description": "申し送りやメモの下書きを作ります。",
        "module_key": "notes",
        "required_role": "staff",
        "risk_level": "low",
        "requires_confirmation": False,
        "is_undoable": False,
    },
    {
        "key": "create_note",
        "name": "メモを作成",
        "description": "確認後に共有メモを作成します。",
        "module_key": "notes",
        "required_role": "staff",
        "risk_level": "medium",
        "requires_confirmation": True,
        "is_undoable": True,
    },
    {
        "key": "update_checklist_item",
        "name": "チェックを更新",
        "description": "確認後にチェックリスト項目の完了状態を変更します。",
        "module_key": "checklists",
        "required_role": "staff",
        "risk_level": "medium",
        "requires_confirmation": True,
        "is_undoable": True,
    },
]


def mark_setup_complete(db: Session) -> None:
    setting = db.scalar(select(Setting).where(Setting.key == "setup_complete"))
    if setting:
        setting.value = "true"
    else:
        db.add(Setting(key="setup_complete", value="true", scope="system"))


def seed_action_definitions(db: Session) -> None:
    existing = {row.key for row in db.scalars(select(AIActionDefinition)).all()}
    for definition in ACTION_DEFINITIONS:
        if definition["key"] in existing:
            continue
        db.add(
            AIActionDefinition(
                input_schema_json=json.dumps({}, ensure_ascii=False),
                result_schema_json=json.dumps({}, ensure_ascii=False),
                is_enabled=True,
                **definition,
            )
        )


def seed_workspace_content(db: Session, workspace: Workspace) -> None:
    use_case = workspace.use_case
    templates = {
        "store": {
            "announcement": ("今日の確認", "開店前にチェックリストと申し送りを確認してください。"),
            "note": ("申し送り", "共有したいことをここに残せます。"),
            "checklist": ("開店チェック", ["入口を整える", "予約と連絡を確認", "レジ周りを確認"]),
        },
        "classroom": {
            "announcement": ("授業前の確認", "教材と連絡事項を確認してください。"),
            "note": ("講師メモ", "授業前後の共有メモを残せます。"),
            "checklist": ("授業準備", ["教材を確認", "出席状況を確認", "片付け場所を確認"]),
        },
        "office": {
            "announcement": ("今日の連絡", "共有事項と提出物を確認してください。"),
            "note": ("チームメモ", "担当者が変わっても残したい情報をまとめます。"),
            "checklist": ("朝の確認", ["共有リンクを確認", "未対応事項を確認", "書類棚を確認"]),
        },
        "community": {
            "announcement": ("運営連絡", "今日の担当と注意事項を確認してください。"),
            "note": ("申し送り", "地域活動の連絡事項を残せます。"),
            "checklist": ("活動準備", ["会場を確認", "備品を確認", "連絡事項を確認"]),
        },
        "personal": {
            "announcement": ("今日の予定", "今日やることとメモをここで確認できます。"),
            "note": ("マイメモ", "自分用のメモや覚え書きをここに残せます。"),
            "checklist": ("今日やること", ["よく使う画面を登録", "書類やマニュアルを置く", "毎日のルーティンを追加"]),
        },
        "empty": {
            "announcement": ("ようこそ", "必要な画面、メモ、書類を管理画面から追加できます。"),
            "note": ("最初のメモ", "このメモは編集できます。"),
            "checklist": ("最初のチェックリスト", ["業務画面を追加", "書類を登録", "スタッフ画面を確認"]),
        },
    }
    template = templates.get(use_case, templates["empty"])

    db.add(
        Announcement(
            title=template["announcement"][0],
            body=template["announcement"][1],
            priority="important",
            is_visible=True,
        )
    )
    db.add(
        Note(
            title=template["note"][0],
            body=template["note"][1],
            is_pinned=True,
            is_staff_visible=True,
        )
    )
    checklist = Checklist(title=template["checklist"][0], is_staff_visible=True)
    db.add(checklist)
    db.flush()
    for index, label in enumerate(template["checklist"][1]):
        db.add(ChecklistItem(checklist_id=checklist.id, label=label, sort_order=index))

